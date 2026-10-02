import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { link, lstat, mkdir, open, readFile, rename, unlink } from "node:fs/promises";
import { resolve } from "node:path";

import { EVENTS_PER_SEGMENT, MAX_EVENT_BYTES, eventFolderDigest } from "./event-stream.js";
import { initialEventState, parseIdeaEvents, reduceIdeaEvent } from "./idea-events.js";
import { isEventAuxiliary, snapshotEventFolderHead } from "./event-storage.js";
import { runGit } from "./git.js";

let runtimeIdentity;

async function identity() {
  runtimeIdentity ??= Promise.all([
    "event-projection.js", "idea-events.js", "event-stream.js", "ideas.js",
    "event-storage.js", "git.js", "git-snapshot.js",
  ]
    .map((name) => readFile(new URL(name, import.meta.url))))
    .then((sources) => createHash("sha256").update(JSON.stringify(
      sources.map((bytes) => createHash("sha256").update(bytes).digest("hex")),
    )).digest("hex"));
  return runtimeIdentity;
}

async function regularFile(path) {
  try {
    const info = await lstat(path);
    if (!info.isFile() || info.isSymbolicLink()
      || (process.platform !== "win32" && (info.mode & 0o077) !== 0)) {
      throw new Error(`Irregular or non-private derived event cache: ${path}`);
    }
    if (info.size > MAX_EVENT_BYTES * 16) throw new Error(`Oversized derived event cache: ${path}`);
    return await readFile(path);
  } catch (cause) {
    if (cause.code === "ENOENT") return null;
    throw cause;
  }
}

async function cacheLocation(root) {
  const worktree = createHash("sha256").update(resolve(root)).digest("hex");
  const result = runGit(root, ["rev-parse", "--path-format=absolute", "--git-path", `silvermoon-event-cache/${worktree}`]);
  if (!result.ok) throw new Error(`Cannot locate derived event cache: ${result.stderr}`);
  const directory = result.stdout;
  for (const path of [resolve(directory, ".."), directory]) {
    try { await mkdir(path, { mode: 0o700 }); }
    catch (cause) { if (cause.code !== "EEXIST") throw cause; }
    const info = await lstat(path);
    if (!info.isDirectory() || info.isSymbolicLink()
      || (process.platform !== "win32" && (info.mode & 0o077) !== 0)) {
      throw new Error("Derived cache must be a regular private directory.");
    }
  }
  const keyPath = resolve(directory, "key");
  let key = await regularFile(keyPath);
  if (key === null) {
    const generated = randomBytes(32);
    const temporary = `${keyPath}.${randomBytes(12).toString("hex")}.prepared`;
    const file = await open(temporary, "wx", 0o600);
    try { await file.writeFile(generated); await file.sync(); }
    finally { await file.close(); }
    try { await link(temporary, keyPath); }
    catch (cause) { if (cause.code !== "EEXIST") throw cause; }
    finally { await unlink(temporary); }
    key = await regularFile(keyPath);
  }
  if (key?.length !== 32) throw new Error(`Invalid local event cache key; preserve and inspect ${keyPath}`);
  return { directory, key };
}

async function readSummary(path, key, context) {
  const bytes = await regularFile(path);
  if (bytes === null) return null;
  const record = JSON.parse(bytes.toString("utf8"));
  if (typeof record.payload !== "string" || !/^[0-9a-f]{64}$/.test(record.mac ?? "")) {
    throw new Error(`Invalid derived event cache; remove only this disposable cache file: ${path}`);
  }
  const expected = createHmac("sha256", key).update(record.payload).digest();
  if (!timingSafeEqual(expected, Buffer.from(record.mac, "hex"))) {
    throw new Error(`Unauthenticated derived event cache; remove only this disposable cache file: ${path}`);
  }
  const summary = JSON.parse(record.payload);
  if (summary.context !== context) throw new Error(`Derived cache source mismatch: ${path}`);
  return summary.state;
}

async function writeSummary(path, key, context, state) {
  const payload = JSON.stringify({ context, state });
  const bytes = Buffer.from(JSON.stringify({
    payload, mac: createHmac("sha256", key).update(payload).digest("hex"),
  }));
  const temporary = `${path}.${randomBytes(12).toString("hex")}.prepared`;
  const file = await open(temporary, "wx", 0o600);
  try { await file.writeFile(bytes); await file.sync(); }
  finally { await file.close(); }
  try { await rename(temporary, path); }
  finally {
    try { await unlink(temporary); }
    catch (cause) { if (cause.code !== "ENOENT") throw cause; }
  }
}

async function reduceSegment(filesystem, entry, ordinal, before, options, sealed) {
  const bytes = await filesystem.snapshotFile(entry.name);
  const events = parseIdeaEvents(bytes, options);
  if (events.length > EVENTS_PER_SEGMENT || (sealed && events.length !== EVENTS_PER_SEGMENT)
    || (!events.length && ordinal !== 1)) throw new Error("Invalid projected segment record count.");
  let offset = 0;
  let state = before;
  for (const event of events) {
    const end = bytes.indexOf(10, offset) + 1;
    if (end - offset > MAX_EVENT_BYTES) throw new Error("Projected event exceeds the byte limit.");
    offset = end;
    const result = reduceIdeaEvent(state, event, options);
    if (!result.ok) throw new Error(`Current log reduction failed: ${result.code} at ${result.sequence}`);
    state = { ...result.state, interaction: { ...result.state.interaction, messages: [] } };
  }
  return { state, bytes };
}

export async function projectEventSnapshot(root, id, paths, options, filesystem) {
  const head = await snapshotEventFolderHead(root, paths, options, filesystem);
  const entries = filesystem.snapshotEntries(paths.eventsDirectory)
    .filter(({ name }) => !isEventAuxiliary(name.slice(paths.eventsDirectory.length + 1)))
    .sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0);
  const { directory, key } = await cacheLocation(root);
  const runtime = await identity();
  let state = initialEventState(id, options);
  const prefix = [];
  let length = 0;
  const contextFor = (segments) => JSON.stringify({
    runtime, id, digest: eventFolderDigest(segments, options), ordinal: segments.length,
  });
  const pathFor = (context) => resolve(directory, `${createHash("sha256").update(context).digest("hex")}.json`);
  for (const entry of entries.slice(0, -1)) {
    if (!Number.isSafeInteger(entry.size) || entry.size < 1) throw new Error("Invalid projected segment size.");
    length += entry.size;
    prefix.push({ name: entry.name.slice(paths.eventsDirectory.length + 1), object: entry.object });
  }
  let verified = prefix.length;
  while (verified > 0) {
    const context = contextFor(prefix.slice(0, verified));
    const cached = await readSummary(pathFor(context), key, context);
    if (cached) { state = cached; break; }
    verified--;
  }
  for (let index = verified; index < entries.length - 1; index++) {
    const entry = entries[index];
    const context = contextFor(prefix.slice(0, index + 1));
    state = (await reduceSegment(filesystem, entry, index + 1, state, options, true)).state;
    await writeSummary(pathFor(context), key, context, state);
  }
  const tail = entries.at(-1);
  const reduced = await reduceSegment(filesystem, tail, entries.length, state, options, false);
  length += reduced.bytes.length;
  if (!Number.isSafeInteger(length)) throw new Error("Projected stream exceeds safe integer addressing.");
  return { digest: head, length, state: reduced.state, tail: { ...tail, bytes: reduced.bytes }, entries };
}
