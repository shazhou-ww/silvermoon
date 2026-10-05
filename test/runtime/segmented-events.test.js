import assert from "node:assert/strict";
import { chmod, lstat, readFile, rm, utimes, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

import { eventCommand } from "../../src/business/event-command.js";
import { EventStream, segmentName } from "../../src/foundation/event-store/index.js";
import { readEventStorage } from "../../src/foundation/event-store/index.js";
import { serializeIdeaEvents } from "../../src/foundation/event-codec/index.js";
import { migrateEvents } from "../../src/business/migrate-v1-to-v2.js";
import { checkRepository } from "../../src/index.js";
import { ideaPaths } from "../../src/foundation/coordinates/index.js";
import { createRepository, FIRST_ID, git } from "../helpers/repository.js";

async function fixture(t) {
  const repository = await createRepository();
  t.after(() => rm(repository.base, { recursive: true, force: true }));
  const { root } = repository;
  const plan = await migrateEvents({ root });
  await migrateEvents({ root, apply: true, expectedDigest: plan.digest });
  const records = [{ sequence: 1, type: "setAlias", payload: { alias: "fixture" } },
    ...Array.from({ length: 999 }, (_, index) => ({
      sequence: index + 2, type: "pong", payload: { message: String(index) },
    }))];
  await writeFile(join(root, ideaPaths(FIRST_ID).eventsPath), serializeIdeaEvents(records));
  git(root, "add", ".");
  git(root, "commit", "-m", "Prepare full segment");
  git(root, "push", "origin", "HEAD:main");
  return repository;
}

async function replay(root) {
  const report = await eventCommand({ root, operation: "replay", idea: FIRST_ID });
  assert.equal(report.observation.state, "event-result", JSON.stringify(report.observation));
  return report.observation.receipt;
}

test("cross-segment append keeps sealed bytes and sequence, with exact prefix retry identity", async (t) => {
  const { root } = await fixture(t);
  const paths = ideaPaths(FIRST_ID);
  const first = await readFile(join(root, paths.eventsPath));
  const info = await lstat(join(root, paths.eventsPath));
  const before = await replay(root);
  const request = {
    root, operation: "append", idea: FIRST_ID,
    input: { type: "ping", payload: { message: "boundary" } },
    expectedLength: before.length, expectedDigest: before.digest,
  };
  assert.equal((await eventCommand(request)).observation.receipt?.sequence, 1001);
  assert.deepEqual(await readFile(join(root, paths.eventsPath)), first);
  assert.equal((await lstat(join(root, paths.eventsPath))).mtimeMs, info.mtimeMs);
  assert.equal((await eventCommand(request)).observation.receipt?.outcome, "already-present");
  const after = await replay(root);
  assert.equal((await eventCommand({
    ...request, expectedLength: after.length, expectedDigest: after.digest,
    input: { type: "pong", payload: { message: "following" } },
  })).observation.receipt?.sequence, 1002);
  assert.equal((await eventCommand(request)).observation.receipt?.outcome, "already-present");
  assert.equal((await eventCommand({
    ...request, input: { type: "ping", payload: { message: "different request" } },
  })).observation.state, "check-unavailable");
  const store = await readEventStorage(root, paths, { objectIdLength: 40 });
  assert.equal(store.entries.length, 2);
  assert.equal(store.digest, EventStream.fromBytes(store.bytes, { objectIdLength: 40 }).digest);
  assert.equal(store.entries[1].name, segmentName(2));
  assert.equal((await checkRepository({ root, worktree: true })).observation.state, "project-ready");
});

test("folder digest excludes auxiliary files but detects any changed historical segment", async (t) => {
  const { root } = await fixture(t);
  const paths = ideaPaths(FIRST_ID);
  const before = await replay(root);
  await writeFile(join(root, paths.eventsDirectory, "checkpoint.json"), "not authoritative\n");
  await writeFile(join(root, paths.eventsDirectory, "cursor.json"), "not authoritative\n");
  assert.equal((await replay(root)).digest, before.digest);
  await chmod(join(root, paths.eventsPath), 0o755);
  await utimes(join(root, paths.eventsPath), new Date(0), new Date(0));
  assert.equal((await replay(root)).digest, before.digest);
  const original = await readFile(join(root, paths.eventsPath), "utf8");
  await writeFile(join(root, paths.eventsPath), original.replace('"message":"0"', '"message":"x"'));
  const changed = await replay(root);
  assert.equal(changed.length, before.length);
  assert.notEqual(changed.digest, before.digest);
  const stale = await eventCommand({
    root, operation: "append", idea: FIRST_ID,
    input: { type: "pong", payload: { message: "stale" } },
    expectedLength: before.length, expectedDigest: before.digest,
  });
  assert.equal(stale.observation.state, "check-unavailable");
  assert.match(stale.observation.problems[0].summary, /Stale/);
});
