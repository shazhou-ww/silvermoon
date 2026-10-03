import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, readdir, rm, utimes, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import { eventCommand } from "../../src/application/event.js";
import { EventStream } from "../../src/events/stream.js";
import { observeGitCommands } from "../../src/repository/git.js";
import { serializeIdeaEvents } from "../../src/events/rules/grammar.js";
import { ideaPaths } from "../../src/project/rules/layout.js";
import { migrateEvents } from "../../src/application/migrations/v1.js";
import { createRepository, FIRST_ID, SECOND_ID, git, writeIdea } from "../helpers/repository.js";

const entry = fileURLToPath(new URL("../../bin/silvermoon.js", import.meta.url));

async function fixture(t, count, objectFormat) {
  const repository = await createRepository({ objectFormat });
  t.after(() => rm(repository.base, { recursive: true, force: true }));
  const { root, base } = repository;
  const migration = await migrateEvents({ root });
  await migrateEvents({ root, apply: true, expectedDigest: migration.digest });
  const paths = ideaPaths(FIRST_ID);
  const bytes = Buffer.from(serializeIdeaEvents([
    { sequence: 1, type: "setAlias", payload: { alias: "fixture" } },
    ...Array.from({ length: count - 1 }, (_, index) => ({
      sequence: index + 2, type: "pong", payload: { message: String(index) },
    })),
  ]));
  const stream = EventStream.fromBytes(bytes, { objectIdLength: objectFormat === "sha256" ? 64 : 40 });
  for (const segment of stream.entries()) {
    const path = join(root, paths.eventsDirectory, segment.name);
    await writeFile(path, segment.bytes);
    await utimes(path, new Date(0), new Date(0));
  }
  const filter = join(base, "measure.cjs");
  const log = join(base, "reads.jsonl");
  await writeFile(log, "");
  await writeFile(filter, `
const fs = require("node:fs");
const bytes = fs.readFileSync(0);
fs.appendFileSync(${JSON.stringify(log)}, JSON.stringify({ path: process.argv[2], bytes: bytes.length }) + "\\n");
fs.writeFileSync(1, bytes);
`);
  await writeFile(join(root, ".gitattributes"), "**/events/*.jsonl -text filter=measure\n");
  git(root, "config", "filter.measure.clean", `"${process.execPath}" "${filter}" %f`);
  git(root, "config", "filter.measure.required", "true");
  git(root, "add", ".");
  git(root, "commit", "-m", "Prepare measurable event stream");
  git(root, "push", "origin", "HEAD:main");
  const request = join(base, "request.json");
  await writeFile(request, JSON.stringify({ type: "pong", payload: { message: "incremental" } }));
  const ioLog = join(base, "runtime-reads.jsonl");
  const probe = join(base, "io-probe.mjs");
  await writeFile(ioLog, "");
  await writeFile(probe, `
import fs from "node:fs";
import childProcess from "node:child_process";
import { syncBuiltinESMExports } from "node:module";
const record = (value) => fs.appendFileSync(${JSON.stringify(ioLog)}, JSON.stringify(value) + "\\n");
const read = fs.promises.readFile;
fs.promises.readFile = async (...args) => {
  const bytes = await read(...args);
  if (typeof args[0] === "string" && args[0].replaceAll("\\\\", "/").includes("/events/") && args[0].includes(".jsonl")) {
    record({ kind: "file", path: args[0], bytes: Buffer.byteLength(bytes) });
  }
  return bytes;
};
const spawn = childProcess.spawnSync;
childProcess.spawnSync = (...args) => {
  const result = spawn(...args);
  const parameters = args[1];
  const position = parameters?.indexOf("cat-file");
  if (position >= 0 && parameters[position + 1] === "blob" && result.status === 0) {
    record({ kind: "blob", object: parameters[position + 2], bytes: Buffer.byteLength(result.stdout) });
  }
  return result;
};
syncBuiltinESMExports();
`);
  return { ...repository, paths, stream, log, request, probe, ioLog };
}

function append(root, request, cursor, probe, extra = []) {
  const child = spawnSync(process.execPath, [...(probe ? ["--import", pathToFileURL(probe).href] : []), entry, "event", "append", FIRST_ID,
    "--input", request, "--expected-length", String(cursor.length),
    "--expected-digest", cursor.digest, ...extra, "--json"], { cwd: root, encoding: "utf8" });
  assert.equal(child.status, 0, child.stderr || child.stdout);
  return JSON.parse(child.stdout).observation.receipt;
}

test("real CLI warm appends and cursor queries do not reread sealed history as the stream grows", async (t) => {
  for (const count of [10001, 100001]) {
    const { root, stream, log, paths, request, probe, ioLog } = await fixture(t, count);
    const first = append(root, request, stream);
    await writeFile(log, "");
    const second = append(root, request, first, probe);
    assert.equal(second.sequence, count + 2);
    const reads = (await readFile(log, "utf8")).trim().split("\n").filter(Boolean).map(JSON.parse);
    assert.ok(reads.every(({ path }) => path.endsWith(stream.entries().at(-1).name)), JSON.stringify(reads));
    assert.ok(reads.reduce((total, { bytes }) => total + bytes, 0) < 10000, JSON.stringify(reads));
    const bodies = [];
    const sealed = new Set(stream.entries().slice(0, -1).map(({ object }) => object));
    const runtimeReads = (await readFile(ioLog, "utf8")).trim().split("\n").filter(Boolean).map(JSON.parse);
    assert.ok(runtimeReads.some(({ kind }) => kind === "file"), "Probe must observe transaction-owned segment rechecks.");
    assert.ok(runtimeReads.some(({ kind }) => kind === "blob"), "Probe must observe the tail Git blob.");
    assert.equal(runtimeReads.some(({ object }) => sealed.has(object)), false);
    assert.ok(runtimeReads.reduce((total, { bytes }) => total + bytes, 0) < 10000, JSON.stringify(runtimeReads));
    const report = await observeGitCommands((args) => {
      if (args[0] === "cat-file" && args[1] === "blob") bodies.push(args[2]);
    }, () => eventCommand({
      root, operation: "append", idea: FIRST_ID,
      input: { type: "pong", payload: { message: "third" } },
      expectedLength: second.length, expectedDigest: second.digest,
    }));
    assert.equal(report.observation.receipt?.sequence, count + 3, JSON.stringify(report.observation));
    assert.equal(bodies.some((object) => sealed.has(object)), false);
    await writeFile(log, "");
    const query = spawnSync(process.execPath, [entry, "event", "replay", FIRST_ID,
      "--after-length", String(second.length), "--after-digest", second.digest, "--json"],
    { cwd: root, encoding: "utf8" });
    assert.equal(query.status, 0, query.stderr || query.stdout);
    const delta = JSON.parse(query.stdout).observation.receipt;
    assert.equal(delta.events.length, 1);
    const queryReads = (await readFile(log, "utf8")).trim().split("\n").filter(Boolean).map(JSON.parse);
    assert.ok(queryReads.every(({ path }) => path.endsWith(stream.entries().at(-1).name)));
    assert.ok(queryReads.reduce((total, { bytes }) => total + bytes, 0) < 10000);
    t.diagnostic(`events=${count} historicalBytes=${stream.length} warmAppendWorktreeBytes=${reads.reduce((total, { bytes }) => total + bytes, 0)} warmAppendRuntimeEventBytes=${runtimeReads.reduce((total, { bytes }) => total + bytes, 0)} cursorWorktreeBytes=${queryReads.reduce((total, { bytes }) => total + bytes, 0)}`);
    const final = EventStream.fromBytes(Buffer.concat([
      stream.bytes(),
      Buffer.from(serializeIdeaEvents([
        { sequence: count + 1, type: "pong", payload: { message: "incremental" } },
        { sequence: count + 2, type: "pong", payload: { message: "incremental" } },
        { sequence: count + 3, type: "pong", payload: { message: "third" } },
      ])),
    ]), { objectIdLength: 40 });
    assert.equal(delta.digest, final.digest);
    assert.equal(await readFile(join(root, paths.eventsPath), "utf8"), stream.entries()[0].bytes.toString("utf8"));
  }
});

test("tampered derived projections fail explicitly and never authorize an append", async (t) => {
  const { root, stream, request, paths } = await fixture(t, 2001);
  const before = append(root, request, stream);
  const worktree = createHash("sha256").update(resolve(git(root, "rev-parse", "--show-toplevel"))).digest("hex");
  const directory = git(root, "rev-parse", "--path-format=absolute", "--git-path", `silvermoon-event-cache/${worktree}`);
  const names = (await readdir(directory)).filter((name) => name.endsWith(".json"));
  const summaries = await Promise.all(names.map(async (name) => {
    const record = JSON.parse(await readFile(join(directory, name), "utf8"));
    return { name, ordinal: JSON.parse(JSON.parse(record.payload).context).ordinal };
  }));
  const projections = summaries.filter(({ ordinal }) => Number.isSafeInteger(ordinal));
  assert.equal(projections.length, 2);
  const cache = join(directory, projections.sort((left, right) => right.ordinal - left.ordinal)[0].name);
  const saved = JSON.parse(await readFile(cache, "utf8"));
  const projection = JSON.parse(saved.payload);
  projection.state.status.abandoned = false;
  saved.payload = JSON.stringify(projection);
  await writeFile(cache, JSON.stringify(saved));
  const priorTail = await readFile(join(root, paths.eventsDirectory, stream.entries().at(-1).name));
  const failed = await eventCommand({
    root, operation: "append", idea: FIRST_ID,
    input: { type: "pong", payload: { message: "must not write" } },
    expectedLength: before.length, expectedDigest: before.digest,
  });
  assert.equal(failed.observation.state, "check-unavailable");
  assert.match(failed.observation.problems[0].summary, /Unauthenticated derived event cache/);
  assert.deepEqual(await readFile(join(root, paths.eventsDirectory, stream.entries().at(-1).name)), priorTail);
  assert.equal(git(root, "ls-files").includes("silvermoon-event-cache"), false);
});

test("authenticated projections bind SHA-256 source content and reject edited sealed prefixes", async (t) => {
  const { root, stream, request, paths } = await fixture(t, 2001, "sha256");
  const before = append(root, request, stream);
  assert.equal(before.digest.length, 64);
  const original = await readFile(join(root, paths.eventsPath), "utf8");
  await writeFile(join(root, paths.eventsPath), original.replace('"message":"0"', '"message":"x"'));
  await utimes(join(root, paths.eventsPath), new Date(0), new Date(0));
  const stale = await eventCommand({
    root, operation: "append", idea: FIRST_ID,
    input: { type: "pong", payload: { message: "stale" } },
    expectedLength: before.length, expectedDigest: before.digest,
  });
  assert.equal(stale.observation.state, "check-unavailable");
  assert.match(stale.observation.problems[0].summary, /Stale cursor digest/);
  const tail = await readFile(join(root, paths.eventsDirectory, stream.entries().at(-1).name), "utf8");
  assert.equal(tail.includes('"message":"stale"'), false);
});

test("alias interaction appends reuse validated projections without losing layout or uniqueness checks", async (t) => {
  const { root, stream, request, paths, log } = await fixture(t, 10001);
  const before = append(root, request, stream);
  await writeFile(log, "");
  const bodies = [];
  const sealed = new Set(stream.entries().slice(0, -1).map(({ object }) => object));
  const report = await observeGitCommands((args) => {
    if (args[0] === "cat-file" && args[1] === "blob") bodies.push(args[2]);
  }, () => eventCommand({
    root, operation: "append", idea: "fixture",
    input: { type: "pong", payload: { message: "alias increment" } },
    expectedLength: before.length, expectedDigest: before.digest,
  }));
  assert.equal(report.observation.receipt?.sequence, 10003, JSON.stringify(report.observation));
  assert.equal(bodies.some((object) => sealed.has(object)), false);
  if (process.platform !== "win32") {
    const reads = (await readFile(log, "utf8")).trim().split("\n").filter(Boolean).map(JSON.parse);
    assert.ok(reads.every(({ path }) => path.endsWith(stream.entries().at(-1).name)));
  }
  const tail = join(root, paths.eventsDirectory, stream.entries().at(-1).name);
  const saved = await readFile(tail);
  const peer = await writeIdea(root, SECOND_ID);
  await rm(join(root, peer.statusPath));
  await mkdir(join(root, peer.eventsDirectory));
  await writeFile(join(root, peer.eventsPath), serializeIdeaEvents([{
    sequence: 1, type: "setAlias", payload: { alias: "fixture" },
  }]));
  const duplicate = await eventCommand({
    root, operation: "append", idea: "fixture",
    input: { type: "pong", payload: { message: "must not choose an owner" } },
    expectedLength: report.observation.receipt.length, expectedDigest: report.observation.receipt.digest,
  });
  assert.equal(duplicate.observation.state, "check-unavailable");
  assert.match(duplicate.observation.problems[0].summary, /invalid layout/);
  assert.deepEqual(await readFile(tail), saved);
});

test("default metadata receipts validate full prefixes incrementally and omit complete message arrays", async (t) => {
  for (const count of [10001, 100001]) {
    const { root, stream, request, log, probe, ioLog } = await fixture(t, count);
    const before = append(root, request, stream);
    const primary = git(root, "rev-parse", "origin/main");
    await writeFile(request, JSON.stringify({ type: "setLanguage", payload: { language: "zh-CN" } }));
    await writeFile(log, "");
    await writeFile(ioLog, "");
    const receipt = append(root, request, before, probe, ["--expected-primary", primary]);
    assert.equal(receipt.sequence, count + 2);
    assert.equal(receipt.history.valid, true);
    assert.equal(receipt.history.detail, "summary");
    const history = receipt.history.results.find(({ id }) => id === FIRST_ID);
    assert.equal(history.base.sequence, count);
    assert.equal(history.candidate.sequence, count + 2);
    assert.equal(Object.hasOwn(history.base, "state"), false);
    const sealed = new Set(stream.entries().slice(0, -1).map(({ object }) => object));
    const runtimeReads = (await readFile(ioLog, "utf8")).trim().split("\n").filter(Boolean).map(JSON.parse);
    assert.equal(runtimeReads.some(({ object }) => sealed.has(object)), false);
    assert.ok(runtimeReads.reduce((total, { bytes }) => total + bytes, 0) < 10000, JSON.stringify(runtimeReads));
    const reads = (await readFile(log, "utf8")).trim().split("\n").filter(Boolean).map(JSON.parse);
    assert.ok(reads.every(({ path }) => path.endsWith(stream.entries().at(-1).name)));
    assert.ok(reads.reduce((total, { bytes }) => total + bytes, 0) < 10000);
    assert.equal(append(root, request, before, undefined, ["--expected-primary", primary]).outcome, "already-present");
    t.diagnostic(`metadataEvents=${count} snapshotEventBytes=${reads.reduce((total, { bytes }) => total + bytes, 0)} runtimeEventBytes=${runtimeReads.reduce((total, { bytes }) => total + bytes, 0)}`);
  }
});

test("explicit full-history metadata output preserves complete historical reductions", async (t) => {
  const { root, stream, request } = await fixture(t, 1001);
  await writeFile(request, JSON.stringify({ type: "setLanguage", payload: { language: "en" } }));
  const receipt = append(root, request, stream, undefined,
    ["--expected-primary", git(root, "rev-parse", "origin/main"), "--full-history"]);
  assert.equal(receipt.outcome, "candidate-written");
  const result = receipt.history.results.find(({ id }) => id === FIRST_ID);
  assert.equal(result.base.state.interaction.messages.length, 1000);
  assert.equal(result.candidate.state.interaction.messages.length, 1000);
  assert.equal(result.candidate.state.status.language, "en");
});
