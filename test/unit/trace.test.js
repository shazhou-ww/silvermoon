import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "node:test";

import {
  traceAsync,
  traceSync,
  withTraceFile,
} from "../../src/trace.js";

const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

async function temporaryTrace(name = "trace.jsonl") {
  const directory = await mkdtemp(join(tmpdir(), "silvermoon-trace-"));
  temporaryDirectories.push(directory);
  return join(directory, name);
}

async function readEvents(path) {
  return (await readFile(path, "utf8"))
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
}

test("writes paired nested spans with wall-clock timestamps and monotonic durations", async () => {
  const path = await temporaryTrace();

  const result = await withTraceFile(
    path,
    "command.test",
    { command: "test" },
    () => traceAsync("async.task", {}, async () =>
      traceSync("sync.task", {}, () => "complete")),
  );

  assert.equal(result, "complete");
  const events = await readEvents(path);
  assert.deepEqual(
    events.map(({ sequence }) => sequence),
    [1, 2, 3, 4, 5, 6],
  );
  assert.equal(new Set(events.map(({ traceId }) => traceId)).size, 1);
  assert.ok(events.every(({ schemaVersion }) => schemaVersion === 1));
  assert.ok(events.every(({ timestamp }) => !Number.isNaN(Date.parse(timestamp))));

  const starts = new Map(
    events
      .filter(({ event }) => event === "span-start")
      .map((event) => [event.name, event]),
  );
  const ends = new Map(
    events
      .filter(({ event }) => event === "span-end")
      .map((event) => [event.name, event]),
  );
  assert.equal(starts.get("command.test").parentSpanId, null);
  assert.equal(
    starts.get("async.task").parentSpanId,
    starts.get("command.test").spanId,
  );
  assert.equal(
    starts.get("sync.task").parentSpanId,
    starts.get("async.task").spanId,
  );
  for (const [name, start] of starts) {
    const end = ends.get(name);
    assert.equal(end.spanId, start.spanId);
    assert.equal(end.status, "ok");
    assert.ok(end.durationMs >= 0);
  }
});

test("records command failures and never overwrites an existing trace", async () => {
  const failedPath = await temporaryTrace("failed.jsonl");
  await assert.rejects(
    withTraceFile(
      failedPath,
      "command.fail",
      {},
      async () => {
        throw new TypeError("expected failure");
      },
    ),
    /expected failure/,
  );
  const failedEvents = await readEvents(failedPath);
  const failedEnd = failedEvents.at(-1);
  assert.equal(failedEnd.event, "span-end");
  assert.equal(failedEnd.name, "command.fail");
  assert.equal(failedEnd.parentSpanId, null);
  assert.equal(failedEnd.status, "error");
  assert.deepEqual(failedEnd.attributes, { errorName: "TypeError" });
  assert.ok(failedEnd.durationMs >= 0);

  const existingPath = await temporaryTrace("existing.jsonl");
  await writeFile(existingPath, "preserve me\n");
  let called = false;
  await assert.rejects(
    withTraceFile(existingPath, "command.test", {}, async () => {
      called = true;
    }),
    /Trace file already exists/,
  );
  assert.equal(called, false);
  assert.equal(await readFile(existingPath, "utf8"), "preserve me\n");
});
