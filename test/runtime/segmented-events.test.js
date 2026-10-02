import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmod, lstat, readFile, rm, utimes, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

import { eventCommand } from "../../src/event-command.js";
import { EventStream, segmentName } from "../../src/event-stream.js";
import { eventStorageChanges, readEventStorage } from "../../src/event-storage.js";
import { inspectIdeaLayout } from "../../src/idea-layout.js";
import { serializeIdeaEvents } from "../../src/idea-events.js";
import { migrateEvents } from "../../src/migrate-events.js";
import { checkRepository } from "../../src/index.js";
import { ideaPaths } from "../../src/layout.js";
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

test("cross-segment interruption resumes or rolls back without resetting sequence", async (t) => {
    for (const rollback of [false, true]) {
      const { root } = await fixture(t);
      const paths = ideaPaths(FIRST_ID);
      const source = await readFile(join(root, paths.eventsPath));
      const record = Buffer.from(serializeIdeaEvents([{
        sequence: 1001, type: "pong", payload: { message: "boundary recovery" },
      }]));
      const path = `${paths.eventsDirectory}/${segmentName(2)}`;
      const context = {
        id: FIRST_ID, localInteraction: true, storage: "segmented",
        afterDigest: EventStream.fromBytes(Buffer.concat([source, record]), { objectIdLength: 40 }).digest,
      };
      const module = new URL("../../src/state-transaction.js", import.meta.url).href;
      const child = spawnSync(process.execPath, ["--input-type=module", "-e", `
        import { stateTransaction } from ${JSON.stringify(module)};
        await stateTransaction(${JSON.stringify(root)}, "events", [{
          path: ${JSON.stringify(path)}, before: null, after: Buffer.from(${JSON.stringify(record.toString("base64"))}, "base64")
        }], {
          context: ${JSON.stringify(context)},
          afterStep: (step) => { if (step === ${JSON.stringify(`prepared:${path}`)}) process.exit(77); }
        });
      `], { encoding: "utf8" });
      assert.equal(child.status, 77, child.stderr);
      const result = await eventCommand({ root, operation: "recover", confirmStopped: true, rollback });
      assert.equal(result.observation.receipt?.outcome, rollback ? "rolled-back" : "recovered",
        JSON.stringify(result.observation));
      assert.deepEqual(await readFile(join(root, paths.eventsPath)), source);
      assert.equal((await replay(root)).reduction.state.sequence, rollback ? 1000 : 1001);
    }
});

test("interrupted multi-segment revision recovers despite a temporary gap in the segment table", async (t) => {
  for (const rollback of [false, true]) {
    const { root } = await fixture(t);
    const paths = ideaPaths(FIRST_ID);
    const original = await readFile(join(root, paths.eventsPath));
    const suffix = Buffer.from(serializeIdeaEvents(Array.from({ length: 2001 }, (_, index) => ({
      sequence: index + 1001, type: "pong", payload: { message: `local ${index}` },
    }))));
    const options = { objectIdLength: 40 };
    const source = EventStream.fromBytes(Buffer.concat([original, suffix]), options);
    for (const { name, bytes } of source.entries()) {
      await writeFile(join(root, paths.eventsDirectory, name), bytes);
    }
    const store = await readEventStorage(root, paths, options);
    const candidate = Buffer.concat([original, Buffer.from(serializeIdeaEvents([{
      sequence: 1001, type: "pong", payload: { message: "reviewed suffix" },
    }]))]);
    const changes = eventStorageChanges(paths, store, candidate, options);
    const layout = await inspectIdeaLayout({ root, config: { version: 2 } });
    assert.equal(layout.diagnostics.length, 0);
    const context = {
      id: FIRST_ID, storage: "segmented", primary: git(root, "rev-parse", "HEAD"),
      revisions: layout.ideas.find(({ id }) => id === FIRST_ID).revisions,
      afterDigest: EventStream.fromBytes(candidate, options).digest,
    };
    const module = new URL("../../src/state-transaction.js", import.meta.url).href;
    const child = spawnSync(process.execPath, ["--input-type=module", "-e", `
      import { stateTransaction } from ${JSON.stringify(module)};
      const files = ${JSON.stringify(changes.map(({ path, before, after }) => ({
        path, before: before?.toString("base64") ?? null, after: after?.toString("base64") ?? null,
      })))}.map(({ path, before, after }) => ({
        path, before: before === null ? null : Buffer.from(before, "base64"),
        after: after === null ? null : Buffer.from(after, "base64")
      }));
      await stateTransaction(${JSON.stringify(root)}, "events", files, {
        context: ${JSON.stringify(context)},
        afterStep: (step) => { if (step === ${JSON.stringify(`applied:${paths.eventsDirectory}/${segmentName(3)}`)}) process.exit(77); }
      });
    `], { encoding: "utf8" });
    assert.equal(child.status, 77, child.stderr);
    const result = await eventCommand({ root, operation: "recover", confirmStopped: true, rollback });
    assert.equal(result.observation.receipt?.outcome, rollback ? "rolled-back" : "recovered",
      JSON.stringify(result.observation));
    assert.deepEqual((await readEventStorage(root, paths, options)).bytes, rollback ? source.bytes() : candidate);
  }
});
