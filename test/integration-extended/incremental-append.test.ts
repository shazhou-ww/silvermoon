import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { eventCommand } from "../../src/business/event-command.ts";
import { serializeIdeaEvents } from "../../src/foundation/event-codec/index.ts";
import { gitContentDigest } from "../../src/foundation/event-store/index.ts";
import { ideaPaths } from "../../src/foundation/coordinates/index.ts";
import { migrateEvents } from "../../src/business/migrate-v1-to-v2.ts";
import {
  createRepository,
  FIRST_ID,
  SECOND_ID,
  git,
  writeIdea,
} from "../helpers/repository.ts";

const entry = fileURLToPath(new URL("../../bin/silvermoon.ts", import.meta.url));

async function fixture(
  t: test.TestContext,
  count: number,
  objectFormat?: "sha1" | "sha256",
) {
  const repository = await createRepository({
    ...(objectFormat === undefined ? {} : { objectFormat }),
  });
  t.after(() => rm(repository.base, { recursive: true, force: true }));
  const { root, base } = repository;
  const migration = await migrateEvents({ root });
  assert.ok("digest" in migration);
  await migrateEvents({ root, apply: true, expectedDigest: migration.digest });
  const paths = ideaPaths(FIRST_ID);
  const bytes = Buffer.from(serializeIdeaEvents([
    { sequence: 1, type: "setAlias", payload: { alias: "fixture" } },
    ...Array.from({ length: count - 1 }, (_, index) => ({
      sequence: index + 2,
      type: "pong",
      payload: { message: String(index) },
    })),
  ]));
  await writeFile(join(root, paths.eventsPath), bytes);
  await writeFile(join(root, ".gitattributes"), "**/events.jsonl -text -filter\n");
  git(root, "add", ".");
  git(root, "commit", "-m", "Prepare single-file event stream");
  git(root, "push", "origin", "HEAD:main");
  const request = join(base, "request.json");
  await writeFile(
    request,
    JSON.stringify({ type: "pong", payload: { message: "incremental" } }),
  );
  const objectIdLength = objectFormat === "sha256" ? 64 : 40;
  return {
    ...repository,
    paths,
    bytes,
    request,
    cursor: {
      length: bytes.length,
      digest: gitContentDigest("blob", bytes, { objectIdLength }),
    },
    objectIdLength,
  };
}

function append(
  root: string,
  request: string,
  cursor: { length: number; digest: string },
  extra: string[] = [],
) {
  const child = spawnSync(process.execPath, [
    entry,
    "event",
    "append",
    FIRST_ID,
    "--input",
    request,
    "--expected-digest",
    cursor.digest,
    ...extra,
    "--json",
  ], { cwd: root, encoding: "utf8", windowsHide: true });
  assert.equal(child.status, 0, child.stderr || child.stdout);
  return JSON.parse(child.stdout).observation.receipt;
}

async function exerciseCliStream(t: test.TestContext, count: number) {
  const {
    root,
    paths,
    bytes,
    request,
    cursor,
    objectIdLength,
  } = await fixture(t, count);
  const first = append(root, request, cursor);
  assert.equal(first.sequence, count + 1);
  assert.equal(append(root, request, cursor).outcome, "already-present");
  const second = append(root, request, first);
  assert.equal(second.sequence, count + 2);
  const query = spawnSync(process.execPath, [
    entry,
    "event",
    "replay",
    FIRST_ID,
    "--after-length",
    String(first.length),
    "--after-digest",
    first.digest,
    "--json",
  ], { cwd: root, encoding: "utf8", windowsHide: true });
  assert.equal(query.status, 0, query.stderr || query.stdout);
  const delta = JSON.parse(query.stdout).observation.receipt;
  assert.deepEqual(delta.events, [{
    sequence: count + 2,
    type: "pong",
    timestamp: second.timestamp,
    payload: { message: "incremental" },
  }]);
  const candidate = await readFile(join(root, paths.eventsPath));
  assert.equal(candidate.subarray(0, bytes.length).equals(bytes), true);
  assert.equal(
    delta.digest,
    gitContentDigest("blob", candidate, { objectIdLength }),
  );
}

test("real CLI preserves a small event stream across child processes", async (t) => {
  await exerciseCliStream(t, 11);
});

test("real CLI preserves large event streams across child processes", async (t) => {
  for (const count of [1001, 10001]) {
    await exerciseCliStream(t, count);
  }
});

test("SHA-256 stale prefixes fail without writing the proposed event", async (t) => {
  const { root, paths, cursor } = await fixture(t, 2001, "sha256");
  assert.equal(cursor.digest.length, 64);
  const original = await readFile(join(root, paths.eventsPath), "utf8");
  await writeFile(
    join(root, paths.eventsPath),
    original.replace('"message":"0"', '"message":"x"'),
  );
  const report = await eventCommand({
    root,
    operation: "append",
    idea: FIRST_ID,
    input: { type: "pong", payload: { message: "stale" } },
    expectedDigest: cursor.digest,
  });
  assert.equal(report.observation.state, "check-unavailable");
  assert.match(report.observation.problems.at(0)?.summary ?? "", /Stale/);
  assert.equal(
    (await readFile(join(root, paths.eventsPath), "utf8")).includes('"message":"stale"'),
    false,
  );
});

test("alias appends retain layout and uniqueness validation", async (t) => {
  const { root, paths, request, cursor } = await fixture(t, 1001);
  const before = append(root, request, cursor);
  const appended = await eventCommand({
    root,
    operation: "append",
    idea: "fixture",
    input: { type: "pong", payload: { message: "alias increment" } },
    expectedDigest: before.digest,
  });
  assert.equal(appended.observation.state, "event-result");
  const saved = await readFile(join(root, paths.eventsPath));
  const peer = await writeIdea(root, SECOND_ID);
  await rm(join(root, peer.statusPath));
  await writeFile(join(root, peer.eventsPath), serializeIdeaEvents([{
    sequence: 1,
    type: "setAlias",
    payload: { alias: "fixture" },
  }]));
  const receipt = appended.observation.receipt;
  assert.equal(typeof receipt.length, "number");
  assert.equal(typeof receipt.digest, "string");
  const duplicate = await eventCommand({
    root,
    operation: "append",
    idea: "fixture",
    input: { type: "pong", payload: { message: "must not choose an owner" } },
    expectedDigest: receipt.digest as string,
  });
  assert.equal(duplicate.observation.state, "check-unavailable");
  assert.match(duplicate.observation.problems.at(0)?.summary ?? "", /invalid layout/);
  assert.deepEqual(await readFile(join(root, paths.eventsPath)), saved);
});

test("tampered blob-bound projections fail without authorizing an append", async (t) => {
  const { root, paths, request, cursor } = await fixture(t, 2001);
  const before = append(root, request, cursor);
  assert.equal(append(root, request, cursor).outcome, "already-present");
  const canonicalRoot = resolve(git(root, "rev-parse", "--show-toplevel"));
  const worktree = createHash("sha256").update(canonicalRoot).digest("hex");
  const directory = git(
    root,
    "rev-parse",
    "--path-format=absolute",
    "--git-path",
    `silvermoon-event-cache/${worktree}`,
  );
  let cache: string | undefined;
  for (const name of await readdir(directory)) {
    if (!name.endsWith(".json")) continue;
    const record = JSON.parse(await readFile(join(directory, name), "utf8"));
    const payload = JSON.parse(record.payload);
    const context = JSON.parse(payload.context);
    if (context.id === FIRST_ID && context.digest === before.digest) {
      cache = join(directory, name);
      payload.state.status.abandoned = true;
      record.payload = JSON.stringify(payload);
      await writeFile(cache, JSON.stringify(record));
      break;
    }
  }
  assert.ok(cache, "Expected a projection cache bound to the current event blob");
  const saved = await readFile(join(root, paths.eventsPath));
  const failed = await eventCommand({
    root,
    operation: "append",
    idea: FIRST_ID,
    input: { type: "pong", payload: { message: "must not write" } },
    expectedDigest: before.digest,
  });
  assert.equal(failed.observation.state, "check-unavailable");
  assert.match(
    failed.observation.problems.at(0)?.summary ?? "",
    /Unauthenticated derived event cache/,
  );
  assert.deepEqual(await readFile(join(root, paths.eventsPath)), saved);
});

test("metadata receipts provide summary and explicit full-history projections", async (t) => {
  const { root, request, cursor } = await fixture(t, 1001);
  const primary = git(root, "rev-parse", "origin/main");
  await writeFile(
    request,
    JSON.stringify({ type: "setLanguage", payload: { language: "zh-CN" } }),
  );
  const summary = append(root, request, cursor, ["--expected-primary", primary]);
  assert.equal(summary.sequence, 1002);
  assert.equal(summary.history.valid, true);
  assert.equal(summary.history.detail, "summary");
  const history = summary.history.results.find(
    ({ id }: { id: string }) => id === FIRST_ID,
  );
  assert.equal(history.base.sequence, 1001);
  assert.equal(history.candidate.sequence, 1002);
  assert.equal(Object.hasOwn(history.base, "state"), false);
  assert.equal(
    append(root, request, cursor, ["--expected-primary", primary]).outcome,
    "already-present",
  );

  const fullFixture = await fixture(t, 11);
  const fullPrimary = git(fullFixture.root, "rev-parse", "origin/main");
  await writeFile(
    fullFixture.request,
    JSON.stringify({ type: "setLanguage", payload: { language: "en" } }),
  );
  const full = append(
    fullFixture.root,
    fullFixture.request,
    fullFixture.cursor,
    ["--expected-primary", fullPrimary, "--full-history"],
  );
  const result = full.history.results.find(
    ({ id }: { id: string }) => id === FIRST_ID,
  );
  assert.equal(result.base.state.interaction.messages.length, 10);
  assert.equal(result.candidate.state.status.language, "en");
});
