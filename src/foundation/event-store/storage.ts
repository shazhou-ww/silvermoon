import { lstat, readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

import {
  EventStream,
  eventFolderDigest,
  gitContentDigest,
} from "./stream.ts";
import { digest } from "../state-transaction/index.ts";

interface EventPaths {
  eventsDirectory: string;
  legacyEventsPath: string;
}

interface StorageOptions {
  allowSingleFile?: boolean;
  objectIdLength: number;
  legacy?: boolean;
  onHash?: (entry: { type: string; bytes: number }) => unknown;
}

interface FileMetadata {
  isDirectory(): boolean;
  isFile(): boolean;
  isSymbolicLink(): boolean;
}

interface StorageFileSystem {
  lstat(path: string): Promise<FileMetadata>;
  readFile(path: string): Promise<Buffer>;
  readdir(path: string): Promise<string[]>;
  snapshotEntry?(path: string): SnapshotEntry | null | undefined;
  snapshotEntries?(path: string): SnapshotEntry[];
  snapshotFile?(path: string): Promise<Buffer>;
}

interface SnapshotEntry {
  mode: string;
  type: string;
  object: string;
  size: number | null;
  name: string;
}

interface StoredSegment {
  name: string;
  bytes: Buffer;
  object: string;
}

export interface SegmentedEventStore {
  storage: "segmented";
  path: string;
  entries: StoredSegment[];
  bytes: Buffer;
  length: number;
  digest: string;
}

export interface SingleFileEventStore {
  storage: "single-file";
  path: string;
  entries: [];
  bytes: Buffer;
  length: number;
  digest: string;
}

export type EventStore = SegmentedEventStore | SingleFileEventStore;

interface RecoveryFile {
  path: string;
  after: string | null;
}

interface StorageChange {
  path: string;
  before: Buffer | null;
  after: Buffer | null;
}

interface CachedSnapshot {
  bytes: Buffer;
  snapshot: EventStream;
  objectIdLength: number;
}

interface CachedCandidate {
  before: EventStream;
  record: Buffer;
  snapshot: EventStream;
}

const FILESYSTEM: StorageFileSystem = {
  lstat,
  readFile: (path) => readFile(path),
  readdir: (path) => readdir(path),
};
const verifiedSnapshots = new WeakMap<EventStore, CachedSnapshot>();
const verifiedCandidates = new WeakMap<EventStore, CachedCandidate>();

export const isEventAuxiliary = (name: string) =>
  ["checkpoint.json", "cursor.json", "lock"].includes(name)
  || name.endsWith(".pending") || name.endsWith(".prepared");

function errorCode(error: unknown): string | undefined {
  if (error === null || typeof error !== "object" || !("code" in error)) return undefined;
  return typeof error.code === "string" ? error.code : undefined;
}

function isRecoveryFile(value: unknown): value is RecoveryFile {
  if (value === null || typeof value !== "object") return false;
  return "path" in value && typeof value.path === "string"
    && "after" in value && (typeof value.after === "string" || value.after === null);
}

function requireBuffer(value: unknown, label: string): Buffer {
  if (!Buffer.isBuffer(value)) throw new TypeError(`${label} must provide raw bytes.`);
  return value;
}

async function metadata(filesystem: StorageFileSystem, path: string) {
  try {
    return await filesystem.lstat(path);
  } catch (error) {
    if (errorCode(error) === "ENOENT") return null;
    throw error;
  }
}

export async function readEventStorage(
  root: string,
  paths: EventPaths,
  options: StorageOptions,
  filesystem: StorageFileSystem = FILESYSTEM,
) {
  return readStorage(root, paths, options, filesystem);
}

export async function readRecoveryEventStorage(
  root: string,
  paths: EventPaths,
  options: StorageOptions,
  files: unknown,
) {
  if (!Array.isArray(files) || !files.every(isRecoveryFile)) {
    throw new TypeError("Event recovery files must be path/base64 records.");
  }
  const replacements = new Map<string, Buffer | null>();
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

async function readStorage(
  root: string,
  paths: EventPaths,
  options: StorageOptions,
  filesystem: StorageFileSystem,
  replacements?: Map<string, Buffer | null>,
): Promise<EventStore> {
  const directory = resolve(root, paths.eventsDirectory);
  const folder = await metadata(filesystem, directory);
  const legacy = await metadata(filesystem, resolve(root, paths.legacyEventsPath));
  if (folder && legacy) throw new Error("Segmented and single-file event authorities cannot coexist.");
  if (!folder) {
    if (!options.allowSingleFile || !legacy?.isFile() || legacy.isSymbolicLink()) {
      throw new Error(`Missing regular event folder: ${paths.eventsDirectory}`);
    }
    const bytes = replacements?.get(paths.legacyEventsPath)
      ?? requireBuffer(
        await filesystem.readFile(resolve(root, paths.legacyEventsPath)),
        "Event file",
      );
    if (bytes === null) throw new Error("Event recovery removed the single-file authority.");
    return {
      storage: "single-file",
      path: paths.legacyEventsPath,
      bytes,
      entries: [],
      length: bytes.length,
      digest: digest(bytes),
    };
  }
  if (!folder.isDirectory() || folder.isSymbolicLink()) {
    throw new Error("Event folder must be a regular directory.");
  }
  const entries: StoredSegment[] = [];
  for (const name of await filesystem.readdir(directory)) {
    const path = resolve(directory, name);
    const info = await filesystem.lstat(path);
    if (!info.isFile() || info.isSymbolicLink()) throw new Error(`Irregular event entry: ${name}`);
    if (isEventAuxiliary(name)) continue;
    const bytes = requireBuffer(await filesystem.readFile(path), `Event segment ${name}`);
    const snapshotEntry = filesystem.snapshotEntry?.(`${paths.eventsDirectory}/${name}`);
    entries.push({
      name,
      bytes,
      object: snapshotEntry?.object ?? gitContentDigest("blob", bytes, options),
    });
  }
  if (replacements) {
    const recovered = new Map(entries.map((entry) => [entry.name, entry]));
    for (const [path, bytes] of replacements) {
      if (!path.startsWith(`${paths.eventsDirectory}/`)) {
        throw new Error("Event recovery storage changed.");
      }
      const name = path.slice(paths.eventsDirectory.length + 1);
      if (bytes === null) recovered.delete(name);
      else recovered.set(name, {
        name,
        bytes,
        object: gitContentDigest("blob", bytes, options),
      });
    }
    entries.splice(0, entries.length, ...recovered.values());
  }
  const head = eventFolderDigest(entries, options);
  entries.sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0);
  const bytes = Buffer.concat(entries.map((entry) => entry.bytes));
  return {
    storage: "segmented",
    path: paths.eventsDirectory,
    entries,
    bytes,
    length: bytes.length,
    digest: head,
  };
}

function requireSnapshotFileSystem(filesystem: StorageFileSystem): asserts filesystem is
  StorageFileSystem & Required<Pick<StorageFileSystem, "snapshotEntry" | "snapshotEntries" | "snapshotFile">> {
  const missing = [
    ["snapshotEntry", filesystem.snapshotEntry],
    ["snapshotEntries", filesystem.snapshotEntries],
    ["snapshotFile", filesystem.snapshotFile],
  ].flatMap(([name, value]) => typeof value === "function" ? [] : [name]);
  if (missing.length > 0) {
    throw new TypeError(
      `Incremental folder operations require an immutable Git snapshot; missing ${missing.join(", ")}.`,
    );
  }
}

export async function snapshotEventFolderHead(
  root: string,
  paths: EventPaths,
  options: StorageOptions,
  filesystem: StorageFileSystem,
) {
  requireSnapshotFileSystem(filesystem);
  const directory = resolve(root, paths.eventsDirectory);
  if (await metadata(filesystem, resolve(root, paths.legacyEventsPath))) {
    throw new Error("Segmented and single-file event authorities cannot coexist.");
  }
  const info = await filesystem.lstat(directory);
  if (!info.isDirectory() || info.isSymbolicLink()) {
    throw new Error("Irregular snapshot event folder.");
  }
  const entries: { name: string; object: string }[] = [];
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

export async function snapshotEventPrefix(
  root: string,
  paths: EventPaths,
  options: StorageOptions,
  filesystem: StorageFileSystem,
  length: unknown,
) {
  if (typeof length !== "number" || !Number.isSafeInteger(length) || length < 0) {
    throw new Error("Prefix length must be a nonnegative safe integer.");
  }
  requireSnapshotFileSystem(filesystem);
  await snapshotEventFolderHead(root, paths, options, filesystem);
  const entries = filesystem.snapshotEntries(paths.eventsDirectory)
    .filter(({ name }) =>
      !isEventAuxiliary(name.slice(paths.eventsDirectory.length + 1)))
    .sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0);
  const prefix: { name: string; object: string }[] = [];
  let remaining = length;
  for (const entry of entries) {
    if (!Number.isSafeInteger(entry.size) || entry.size === null || entry.size < 0) {
      throw new Error("Invalid prefix segment size.");
    }
    if (remaining === 0) break;
    const name = entry.name.slice(paths.eventsDirectory.length + 1);
    if (remaining >= entry.size) {
      prefix.push({ name, object: entry.object });
      remaining -= entry.size;
    } else {
      const bytes = requireBuffer(await filesystem.snapshotFile(entry.name), "Snapshot segment");
      prefix.push({
        name,
        object: gitContentDigest("blob", bytes.subarray(0, remaining), options),
      });
      remaining = 0;
    }
  }
  if (remaining !== 0) {
    throw new Error("Primary event prefix was shortened; preserve the candidate.");
  }
  return prefix.length
    ? eventFolderDigest(prefix, options)
    : EventStream.fromBytes(Buffer.alloc(0), options).digest;
}

function verifiedStore(store: EventStore, options: StorageOptions) {
  const cached = verifiedSnapshots.get(store);
  if (cached?.objectIdLength === options.objectIdLength && cached.bytes.equals(store.bytes)) {
    return cached.snapshot;
  }
  const snapshot = EventStream.fromSegments(store.entries, options);
  if (!snapshot.bytes().equals(store.bytes)) {
    throw new Error("Storage bytes disagree with the canonical segment table.");
  }
  verifiedSnapshots.set(store, {
    bytes: Buffer.from(store.bytes),
    snapshot,
    objectIdLength: options.objectIdLength,
  });
  return snapshot;
}

function appendedSnapshot(store: EventStore, bytes: Buffer, options: StorageOptions) {
  if (bytes.length <= store.bytes.length
    || !bytes.subarray(0, store.bytes.length).equals(store.bytes)) return null;
  const suffix = bytes.subarray(store.bytes.length);
  if (suffix.indexOf(10) !== suffix.length - 1) return null;
  const before = verifiedStore(store, options);
  const cached = verifiedCandidates.get(store);
  if (cached?.before === before && cached.record.equals(suffix)) return cached.snapshot;
  const snapshot = before.append(suffix);
  verifiedCandidates.set(store, { before, record: Buffer.from(suffix), snapshot });
  return snapshot;
}

export function storageDigest(store: EventStore, bytes: Buffer, options: StorageOptions) {
  if (store.storage === "single-file") return digest(bytes);
  const isPrefix = bytes.length <= store.bytes.length
    && store.bytes.subarray(0, bytes.length).equals(bytes);
  if (isPrefix) return verifiedStore(store, options).prefixDigest(bytes.length);
  const appended = appendedSnapshot(store, bytes, options);
  if (appended) return appended.digest;
  return EventStream.fromBytes(bytes, options).digest;
}

export function eventStorageChanges(
  paths: EventPaths,
  store: EventStore,
  candidate: Buffer,
  options: StorageOptions,
): StorageChange[] {
  if (store.storage === "single-file") {
    return [{ path: paths.legacyEventsPath, before: store.bytes, after: candidate }];
  }
  const appended = appendedSnapshot(store, candidate, options);
  if (appended) {
    return appended.changesSince(verifiedStore(store, options)).map(({ name, before, after }) => ({
      path: `${paths.eventsDirectory}/${name}`,
      before,
      after,
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
