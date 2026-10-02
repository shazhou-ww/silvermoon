import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { eventCommand } from "../../src/event-command.js";
import { EventStream } from "../../src/event-stream.js";
import { observeGitCommands } from "../../src/git.js";
import { serializeIdeaEvents } from "../../src/idea-events.js";
import { ideaPaths } from "../../src/layout.js";
import { migrateEvents } from "../../src/migrate-events.js";
import { createRepository, FIRST_ID, git } from "../helpers/repository.js";

async function fixture(t) {
  const repository = await createRepository();
  t.after(() => rm(repository.base, { recursive: true, force: true }));
  const { root } = repository;
  const plan = await migrateEvents({ root });
  await migrateEvents({ root, apply: true, expectedDigest: plan.digest });
  const source = Buffer.from(serializeIdeaEvents([
    { sequence: 1, type: "setAlias", payload: { alias: "fixture" } },
    ...Array.from({ length: 999 }, (_, index) => ({
      sequence: index + 2, type: "pong", payload: { message: String(index) },
    })),
  ]));
  const paths = ideaPaths(FIRST_ID);
  await writeFile(join(root, paths.eventsPath), source);
  git(root, "add", ".");
  git(root, "commit", "-m", "Prepare cursor fixture");
  git(root, "push", "origin", "HEAD:main");
  return { ...repository, paths, source };
}

async function replay(root, cursor) {
  return eventCommand({
    root, operation: "replay", idea: FIRST_ID,
    ...(cursor ? { afterLength: cursor.length, afterDigest: cursor.digest } : {}),
  });
}

test("cursor replay returns only the verified suffix and never substitutes for full reduction", async (t) => {
  const { root, paths } = await fixture(t);
  const before = (await replay(root)).observation.receipt;
  const sealed = git(root, "rev-parse", `HEAD:${paths.eventsPath}`);
  const appended = await eventCommand({
    root, operation: "append", idea: FIRST_ID,
    input: { type: "pong", payload: { message: "new event" } },
    expectedLength: before.length, expectedDigest: before.digest,
  });
  assert.equal(appended.observation.receipt?.sequence, 1001);
  const commands = [];
  const report = await observeGitCommands((args) => commands.push(args), () => replay(root, before));
  const delta = report.observation.receipt;
  assert.equal(delta?.outcome, "delta-observed", JSON.stringify(report.observation));
  assert.deepEqual(delta.events, [{ sequence: 1001, type: "pong", payload: { message: "new event" } }]);
  assert.equal(delta.sequence, 1001);
  assert.equal(Object.hasOwn(delta, "reduction"), false);
  assert.equal(commands.some((args) => args[0] === "cat-file" && args.includes(sealed)), false);
  const unchanged = await replay(root, delta);
  assert.deepEqual(unchanged.observation.receipt?.events, []);
  assert.equal(unchanged.observation.receipt?.sequence, 1001);
  assert.equal((await replay(root)).observation.receipt.reduction.state.interaction.messages.length, 1000);
  const original = await readFile(join(root, paths.eventsPath), "utf8");
  await writeFile(join(root, paths.eventsPath), original.replace('"message":"0"', '"message":"x"'));
  const stale = await replay(root, before);
  assert.equal(stale.observation.state, "check-unavailable");
  assert.match(stale.observation.problems[0].summary, /Stale cursor digest/);
});

test("cursor replay validates partial-segment boundaries and initial empty streams", async (t) => {
  const { root, paths, source } = await fixture(t);
  const partial = source.subarray(0, source.indexOf(10) + 1);
  const cursor = {
    length: partial.length, digest: EventStream.fromBytes(partial, { objectIdLength: 40 }).digest,
  };
  const report = await replay(root, cursor);
  assert.equal(report.observation.receipt?.events.length, 999);
  assert.equal(report.observation.receipt?.sequence, 1000);
  const invalid = await replay(root, { ...cursor, length: partial.length - 1 });
  assert.match(invalid.observation.problems[0].summary, /not an event boundary/);
  await writeFile(join(root, paths.eventsPath), "");
  const empty = EventStream.fromBytes(Buffer.alloc(0), { objectIdLength: 40 });
  const initial = await replay(root, { length: 0, digest: empty.digest });
  assert.deepEqual(initial.observation.receipt?.events, []);
  assert.equal(initial.observation.receipt?.sequence, 0);
});

test("CLI exposes cursor replay additively and rejects incomplete or write-side cursor options", async (t) => {
  const { root } = await fixture(t);
  const before = (await replay(root)).observation.receipt;
  const entry = fileURLToPath(new URL("../../bin/silvermoon.js", import.meta.url));
  const run = (...args) => spawnSync(process.execPath, [entry, ...args], { cwd: root, encoding: "utf8" });
  const result = run("event", "replay", FIRST_ID,
    "--after-length", String(before.length), "--after-digest", before.digest, "--json");
  assert.equal(result.status, 0, result.stderr);
  const delta = JSON.parse(result.stdout).observation.receipt;
  assert.deepEqual(delta.events, []);
  assert.equal(delta.outcome, "delta-observed");
  assert.equal(run("event", "replay", FIRST_ID, "--after-length", "1", "--json").status, 2);
  assert.equal(run("event", "replay", FIRST_ID, "--after-length", "-1", "--after-digest", before.digest, "--json").status, 2);
  assert.equal(run("event", "recover", "--after-length", "0", "--after-digest", before.digest, "--json").status, 2);
  const alias = await eventCommand({
    root, operation: "replay", idea: "fixture", afterLength: before.length, afterDigest: before.digest,
  });
  assert.match(alias.observation.problems[0].summary, /canonical idea ULID/);
  const truncated = await replay(root, { length: before.length + 1, digest: before.digest });
  assert.match(truncated.observation.problems[0].summary, /Stale cursor length/);
});
