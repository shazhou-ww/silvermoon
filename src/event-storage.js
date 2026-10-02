import { lstat, readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

import { EventStream, eventFolderDigest, gitContentDigest } from "./event-stream.js";
import { digest } from "./state-transaction.js";

const FILESYSTEM = { lstat, readFile, readdir };
const verifiedSnapshots = new WeakMap();
const verifiedCandidates = new WeakMap();
export const isEventAuxiliary = (name) =>
  ["checkpoint.json", "cursor.json", "lock"].includes(name)
  || name.endsWith(".pending") || name.endsWith(".prepared");

async function metadata(filesystem, path) {
  try { return await filesystem.lstat(path); }
  catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

export async function readEventStorage(root, paths, options, filesystem = FILESYSTEM) {
  return readStorage(root, paths, options, filesystem);
}

export async function readRecoveryEventStorage(root, paths, options, files) {
  const replacements = new Map();
  for (const file of files) {
    if (file.path !== paths.legacyEventsPath
      && (!file.path.startsWith(`${paths.eventsDirectory}/`)
        || file.path.slice(paths.eventsDirectory.length + 1).includes("/"))) {
      throw new Error("Event recovery path mismatch.");
    }
    replacements.set(file.path, file.after === null ? null : Buffer.from(file.after, "base64"));
  }
  if (replacements.has(paths.legacyEventsPath)
    && (files.length !== 1 || replacements.get(paths.legacyEventsPath) === null)) {
    throw new Error("Event recovery requires one complete single-file replacement.");
  }
  return readStorage(root, paths, options, FILESYSTEM, replacements);
}

async function readStorage(root, paths, options, filesystem, replacements) {
  const directory = resolve(root, paths.eventsDirectory);
  const folder = await metadata(filesystem, directory);
  const legacy = await metadata(filesystem, resolve(root, paths.legacyEventsPath));
  if (folder && legacy) throw new Error("Segmented and single-file event authorities cannot coexist.");
  if (!folder) {
    if (!options.allowSingleFile || !legacy?.isFile() || legacy.isSymbolicLink()) {
      throw new Error(`Missing regular event folder: ${paths.eventsDirectory}`);
    }
    const bytes = replacements?.get(paths.legacyEventsPath)
      ?? await filesystem.readFile(resolve(root, paths.legacyEventsPath));
    return { storage: "single-file", path: paths.legacyEventsPath, bytes,
      entries: [], length: bytes.length, digest: digest(bytes) };
  }
  if (!folder.isDirectory() || folder.isSymbolicLink()) throw new Error("Event folder must be a regular directory.");
  const entries = [];
  for (const name of await filesystem.readdir(directory)) {
    const path = resolve(directory, name);
    const info = await filesystem.lstat(path);
    if (!info.isFile() || info.isSymbolicLink()) throw new Error(`Irregular event entry: ${name}`);
    if (isEventAuxiliary(name)) continue;
    const bytes = await filesystem.readFile(path);
    const snapshotEntry = filesystem.snapshotEntry?.(`${paths.eventsDirectory}/${name}`);
    entries.push({ name, bytes, object: snapshotEntry?.object ?? gitContentDigest("blob", bytes, options) });
  }
  if (replacements) {
    const recovered = new Map(entries.map((entry) => [entry.name, entry]));
    for (const [path, bytes] of replacements) {
      if (!path.startsWith(`${paths.eventsDirectory}/`)) throw new Error("Event recovery storage changed.");
      const name = path.slice(paths.eventsDirectory.length + 1);
      if (bytes === null) recovered.delete(name);
      else recovered.set(name, { name, bytes, object: gitContentDigest("blob", bytes, options) });
    }
    entries.splice(0, entries.length, ...recovered.values());
  }
  const head = eventFolderDigest(entries, options);
  entries.sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0);
  const bytes = Buffer.concat(entries.map((entry) => entry.bytes));
  return { storage: "segmented", path: paths.eventsDirectory, entries, bytes,
    length: bytes.length, digest: head };
}

export async function snapshotEventFolderHead(root, paths, options, filesystem) {
  if (typeof filesystem.snapshotEntry !== "function") {
    throw new TypeError("Incremental folder HEAD requires an immutable Git snapshot.");
  }
  const directory = resolve(root, paths.eventsDirectory);
  const info = await filesystem.lstat(directory);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("Irregular snapshot event folder.");
  const entries = [];
  for (const name of await filesystem.readdir(directory)) {
    const path = `${paths.eventsDirectory}/${name}`;
    const entry = filesystem.snapshotEntry(path);
    if (!entry || entry.type !== "blob" || !["100644", "100755"].includes(entry.mode)) {
      throw new Error(`Irregular snapshot segment: ${name}`);
    }
    if (!isEventAuxiliary(name)) entries.push({ name, object: entry.object });
  }
  return eventFolderDigest(entries, options);
}

function verifiedStore(store, options) {
  const cached = verifiedSnapshots.get(store);
  if (cached?.objectIdLength === options.objectIdLength && cached.bytes.equals(store.bytes)) return cached.snapshot;
  const snapshot = EventStream.fromSegments(store.entries, options);
  if (!snapshot.bytes().equals(store.bytes)) throw new Error("Storage bytes disagree with the canonical segment table.");
  verifiedSnapshots.set(store, { bytes: Buffer.from(store.bytes), snapshot, objectIdLength: options.objectIdLength });
  return snapshot;
}

function appendedSnapshot(store, bytes, options) {
  if (bytes.length <= store.bytes.length || !bytes.subarray(0, store.bytes.length).equals(store.bytes)) return null;
  const suffix = bytes.subarray(store.bytes.length);
  if (suffix.indexOf(10) !== suffix.length - 1) return null;
  const before = verifiedStore(store, options);
  const cached = verifiedCandidates.get(store);
  if (cached?.before === before && cached.record.equals(suffix)) return cached.snapshot;
  const snapshot = before.append(suffix);
  verifiedCandidates.set(store, { before, record: Buffer.from(suffix), snapshot });
  return snapshot;
}

export function storageDigest(store, bytes, options) {
  if (store.storage === "single-file") return digest(bytes);
  const isPrefix = bytes.length <= store.bytes.length && store.bytes.subarray(0, bytes.length).equals(bytes);
  if (isPrefix) return verifiedStore(store, options).prefixDigest(bytes.length);
  const appended = appendedSnapshot(store, bytes, options);
  if (appended) return appended.digest;
  return EventStream.fromBytes(bytes, options).digest;
}

export function eventStorageChanges(paths, store, candidate, options) {
  if (store.storage === "single-file") {
    return [{ path: paths.legacyEventsPath, before: store.bytes, after: candidate }];
  }
  const appended = appendedSnapshot(store, candidate, options);
  if (appended) {
    return appended.changesSince(verifiedStore(store, options)).map(({ name, before, after }) => ({
      path: `${paths.eventsDirectory}/${name}`, before, after,
    }));
  }
  const next = EventStream.fromBytes(candidate, options).entries();
  const before = new Map(store.entries.map(({ name, bytes }) => [name, bytes]));
  const after = new Map(next.map(({ name, bytes }) => [name, bytes]));
  return [...new Set([...before.keys(), ...after.keys()])].sort().flatMap((name) => {
    const original = before.get(name) ?? null;
    const replacement = after.get(name) ?? null;
    if (original !== null && replacement !== null && original.equals(replacement)) return [];
    return [{ path: `${paths.eventsDirectory}/${name}`, before: original, after: replacement }];
  });
}
