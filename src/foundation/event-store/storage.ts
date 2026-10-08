import { lstat, readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  gitContentDigest,
  validateEventRecordSizes,
} from "./digest.ts";

interface EventPaths {
  eventsPath: string;
}

interface StorageOptions {
  objectIdLength: number;
  legacy?: boolean;
  onHash?: (entry: { type: string; bytes: number }) => unknown;
}

interface FileMetadata {
  isDirectory(): boolean;
  isFile(): boolean;
  isSymbolicLink(): boolean;
}

interface SnapshotEntry {
  mode: string;
  type: string;
  object: string;
  size: number | null;
  name: string;
}

interface StorageFileSystem {
  lstat(path: string): Promise<FileMetadata>;
  readFile(path: string): Promise<Buffer>;
  snapshotEntry?(path: string): SnapshotEntry | null | undefined;
  snapshotFile?(path: string): Promise<Buffer>;
}

export interface EventStore {
  storage: "single-file";
  path: string;
  entries: [];
  bytes: Buffer;
  length: number;
  digest: string;
}

interface RecoveryFile {
  path: string;
  after: string | null;
}

interface StorageChange {
  path: string;
  before: Buffer | null;
  after: Buffer | null;
}

const FILESYSTEM: StorageFileSystem = {
  lstat,
  readFile: (path) => readFile(path),
};

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

function eventDigest(
  bytes: Buffer,
  options: StorageOptions,
) {
  options.onHash?.({ type: "blob", bytes: bytes.length });
  return gitContentDigest("blob", bytes, options);
}

async function readStorage(
  root: string,
  paths: EventPaths,
  options: StorageOptions,
  filesystem: StorageFileSystem,
  replacement?: Buffer,
): Promise<EventStore> {
  const absolute = resolve(root, paths.eventsPath);
  const info = await metadata(filesystem, absolute);
  if (!info || !info.isFile() || info.isSymbolicLink()) {
    throw new Error(`Missing regular event file: ${paths.eventsPath}`);
  }
  const bytes = replacement ?? requireBuffer(
    await filesystem.readFile(absolute),
    "Event file",
  );
  validateEventRecordSizes(bytes);
  return {
    storage: "single-file",
    path: paths.eventsPath,
    entries: [],
    bytes,
    length: bytes.length,
    digest: eventDigest(bytes, options),
  };
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
  if (!Array.isArray(files) || files.length !== 1 || !files.every(isRecoveryFile)) {
    throw new TypeError("Event recovery requires one complete file record.");
  }
  const [file] = files;
  if (!file || file.path !== paths.eventsPath || file.after === null) {
    throw new Error("Event recovery path mismatch.");
  }
  return readStorage(
    root,
    paths,
    options,
    FILESYSTEM,
    Buffer.from(file.after, "base64"),
  );
}

function requireSnapshotFileSystem(
  filesystem: StorageFileSystem,
): asserts filesystem is StorageFileSystem & Required<
  Pick<StorageFileSystem, "snapshotEntry" | "snapshotFile">
> {
  if (typeof filesystem.snapshotEntry !== "function"
    || typeof filesystem.snapshotFile !== "function") {
    throw new TypeError("Event snapshot operations require immutable file capabilities.");
  }
}

export async function snapshotEventFileHead(
  _root: string,
  paths: EventPaths,
  options: StorageOptions,
  filesystem: StorageFileSystem,
) {
  requireSnapshotFileSystem(filesystem);
  const entry = filesystem.snapshotEntry(paths.eventsPath);
  if (!entry || entry.type !== "blob" || !["100644", "100755"].includes(entry.mode)
    || !new RegExp(`^[0-9a-f]{${options.objectIdLength}}$`).test(entry.object)) {
    throw new Error(`Irregular snapshot event file: ${paths.eventsPath}`);
  }
  return entry.object;
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
  const head = await snapshotEventFileHead(root, paths, options, filesystem);
  const bytes = requireBuffer(
    await filesystem.snapshotFile(paths.eventsPath),
    "Snapshot event file",
  );
  if (length > bytes.length) {
    throw new Error("Primary event prefix was shortened; preserve the candidate.");
  }
  if (length === bytes.length) return head;
  return eventDigest(bytes.subarray(0, length), options);
}

export function storageDigest(
  _store: EventStore,
  bytes: Buffer,
  options: StorageOptions,
) {
  validateEventRecordSizes(bytes);
  return eventDigest(bytes, options);
}

export function eventStorageChanges(
  paths: EventPaths,
  store: EventStore,
  candidate: Buffer,
  _options: StorageOptions,
): StorageChange[] {
  validateEventRecordSizes(candidate);
  return [{
    path: paths.eventsPath,
    before: store.bytes,
    after: candidate,
  }];
}
