import { createHash, randomUUID } from "node:crypto";
import { hostname } from "node:os";
import { dirname, resolve } from "node:path";
import { link, lstat, mkdir, open, readFile, readdir, rename, rmdir, unlink } from "node:fs/promises";

import { isValidUlid } from "../idea-model/index.ts";
import type { PathLike } from "node:fs";

export const TRANSACTION_PATH = ".silvermoon/transaction";
export const digest = (bytes: string|NodeJS.ArrayBufferView<ArrayBufferLike>) => createHash("sha256").update(bytes).digest("hex");

type TransactionBytes = string | Uint8Array<ArrayBufferLike>;
type TransactionFile = {
  path: string;
  before: TransactionBytes | null;
  after: TransactionBytes | null;
};
type EncodedTransactionFile = {
  path: string;
  before: string | null;
  after: string | null;
};
type TransactionPlan = {
  kind: "events" | "migration";
  pid: number;
  host: string;
  files: EncodedTransactionFile[];
  directories?: string[];
  removeDirectories?: string[];
  context?: unknown;
};
type TransactionOptions = {
  afterStep?: (step: string) => void | Promise<void>;
  validate?: () => void | Promise<void>;
  validateApplied?: () => void | Promise<void>;
  context?: unknown;
  directories?: string[];
  removeDirectories?: string[];
};
type RecoveryOptions = {
  rollback?: boolean;
  confirmedStopped?: boolean;
  kind?: TransactionPlan["kind"];
  validate?: (plan: TransactionPlan) => void | Promise<void>;
  validateRollback?: (plan: TransactionPlan) => void | Promise<void>;
  validateApplied?: (plan: TransactionPlan) => void | Promise<void>;
};

function hasErrorCode(caught: unknown, code: string) {
  return caught instanceof Error && "code" in caught && caught.code === code;
}

function errorMessage(caught: unknown) {
  return caught instanceof Error ? caught.message : String(caught);
}

export async function regularBytes(path: PathLike) {
  try {
    const metadata = await lstat(path);
    if (!metadata.isFile() || metadata.isSymbolicLink()) throw new Error(`Not a regular file: ${path}`);
    return await readFile(path);
  } catch (error) {
    if (hasErrorCode(error, "ENOENT")) return null;
    throw error;
  }
}

async function durableFile(path: PathLike, bytes: string|NodeJS.ArrayBufferView<ArrayBufferLike>|Buffer<ArrayBuffer>|Iterable<string|NodeJS.ArrayBufferView<ArrayBufferLike>>|AsyncIterable<string|NodeJS.ArrayBufferView<ArrayBufferLike>>) {
  const file = await open(path, "wx");
  try {
    await file.writeFile(bytes);
    await file.sync();
  } finally {
    await file.close();
  }
}

async function syncDirectory(path: PathLike) {
  // Node cannot fsync directory handles on Windows; files are synced before rename.
  if (process.platform === "win32") return;
  const directory = await open(path, "r");
  try { await directory.sync(); } finally { await directory.close(); }
}

function allowedPath(path: string) {
  if (path === ".silvermoon/config.yaml" || path === ".gitattributes") return true;
  const match = /^\.silvermoon\/ideas\/([^/]+)\/(status\.yaml|events\.jsonl|events\/[0-9]{16}\.jsonl)$/.exec(path);
  const id = match?.[1];
  const statePath = match?.[2];
  if (id === undefined || statePath === undefined || !isValidUlid(id)) return false;
  if (!statePath.startsWith("events/")) return true;
  const ordinal = Number(statePath.slice(7, -6));
  return Number.isSafeInteger(ordinal) && ordinal > 0;
}

async function checkParents(root: string, path: string) {
  const parts = path.split("/").slice(0, -1);
  for (let index = 1; index <= parts.length; index++) {
    const parent = await lstat(resolve(root, ...parts.slice(0, index)));
    if (!parent.isDirectory() || parent.isSymbolicLink()) throw new Error(`Irregular transaction parent: ${path}`);
  }
}

export async function stateBytes(root: string, path: string) {
  if (!allowedPath(path)) throw new Error(`Unsupported state path: ${path}`);
  await checkParents(root, path);
  return regularBytes(resolve(root, path));
}

function decode(value: string|null) {
  if (value === null) return null;
  if (typeof value !== "string" || Buffer.from(value, "base64").toString("base64") !== value) {
    throw new Error("Transaction backup is not canonical base64.");
  }
  return Buffer.from(value, "base64");
}

function equal(left: NonSharedBuffer|null, right: NonSharedBuffer|null) {
  return left === null || right === null ? left === right : left.equals(right);
}

function validateDirectories(value: unknown, label: string) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)
    || !value.every((directory): directory is string => typeof directory === "string")
    || new Set(value).size !== value.length
    || value.some((path) => {
      const match = /^\.silvermoon\/ideas\/([^/]+)\/events$/.exec(path);
      return !match || match[1] === undefined || !isValidUlid(match[1]);
    })) {
    throw new Error(`Unsafe transaction ${label}.`);
  }
  return value;
}

function validatePlan(value: unknown): TransactionPlan {
  if (typeof value !== "object" || value === null
    || !("kind" in value) || (value.kind !== "events" && value.kind !== "migration")
    || !("files" in value) || !Array.isArray(value.files)
    || !("pid" in value) || typeof value.pid !== "number"
    || !Number.isSafeInteger(value.pid) || value.pid < 1
    || !("host" in value) || typeof value.host !== "string") {
    throw new Error("Invalid state transaction plan; preserve it for manual recovery.");
  }
  const directories = validateDirectories(
    "directories" in value ? value.directories : undefined,
    "directories",
  );
  const removeDirectories = validateDirectories(
    "removeDirectories" in value ? value.removeDirectories : undefined,
    "removed directories",
  );
  if (directories?.some((directory) => removeDirectories?.includes(directory))) {
    throw new Error("Transaction cannot create and remove the same directory.");
  }
  const paths = new Set<string>();
  const files: EncodedTransactionFile[] = [];
  for (const candidate of value.files) {
    if (typeof candidate !== "object" || candidate === null
      || !("path" in candidate) || typeof candidate.path !== "string"
      || !("before" in candidate) || (candidate.before !== null && typeof candidate.before !== "string")
      || !("after" in candidate) || (candidate.after !== null && typeof candidate.after !== "string")
      || !allowedPath(candidate.path) || paths.has(candidate.path)) {
      throw new Error("Unsafe or repeated transaction path.");
    }
    paths.add(candidate.path);
    decode(candidate.before);
    decode(candidate.after);
    files.push({
      path: candidate.path,
      before: candidate.before,
      after: candidate.after,
    });
  }
  return {
    kind: value.kind,
    pid: value.pid,
    host: value.host,
    files,
    ...(directories === undefined ? {} : { directories }),
    ...(removeDirectories === undefined ? {} : { removeDirectories }),
    ...("context" in value ? { context: value.context } : {}),
  };
}

async function applyPlan(
  root: string,
  plan: TransactionPlan,
  rollback: boolean,
  afterStep?: (step: string) => void | Promise<void>,
) {
  const managedDirectories = [
    ...(plan.directories ?? []),
    ...(plan.removeDirectories ?? []),
  ];
  for (const directory of managedDirectories) {
    await checkParents(root, directory);
    const path = resolve(root, directory);
    try { await mkdir(path); }
    catch (cause) {
      if (!hasErrorCode(cause, "EEXIST")) throw cause;
      const info = await lstat(path);
      if (!info.isDirectory() || info.isSymbolicLink()) throw new Error(`Irregular transaction directory: ${directory}`);
    }
    const allowed = new Set(plan.files.filter((file: { path: string; }) => dirname(file.path) === directory)
      .flatMap((file: { path: string|unknown[]; }) => [file.path.slice(directory.length + 1), `${file.path.slice(directory.length + 1)}.pending`]));
    for (const name of await readdir(path)) {
      if (!allowed.has(name)) throw new Error(`Unknown transaction directory entry: ${directory}/${name}`);
    }
  }
  // Validate every current source before touching any of them.
  for (const file of plan.files) {
    await checkParents(root, file.path);
    const current = await regularBytes(resolve(root, file.path));
    if (!equal(current, decode(file.before)) && !equal(current, decode(file.after))) {
      throw new Error(`Transaction conflict at ${file.path}; unknown content was preserved.`);
    }
  }
  for (const file of rollback ? [...plan.files].reverse() : plan.files) {
    const path = resolve(root, file.path);
    const next = decode(rollback ? file.before : file.after);
    const current = await regularBytes(path);
    if (!equal(current, decode(file.before)) && !equal(current, decode(file.after))) {
      throw new Error(`Transaction source changed during application: ${file.path}; unknown content was preserved.`);
    }
    const temporary = `${path}.pending`;
    const pending = await regularBytes(temporary);
    if (pending !== null && !equal(pending, decode(file.after)) && !equal(pending, decode(file.before))) {
      throw new Error(`Unknown pending bytes at ${temporary}; preserve and investigate.`);
    }
    if (equal(current, next)) {
      if (pending !== null) await unlink(temporary);
      continue;
    }
    if (pending !== null && !equal(pending, next)) await unlink(temporary);
    if (next === null) {
      await unlink(path);
    } else {
      if (!equal(pending, next)) await durableFile(temporary, next);
      await afterStep?.(`prepared:${file.path}`);
      // Detect non-cooperating edits too; the lock serializes project CLI writers.
      if (!equal(await regularBytes(path), current)) throw new Error(`Concurrent external edit at ${file.path}`);
      await rename(temporary, path);
    }
    await syncDirectory(dirname(path));
    await afterStep?.(`applied:${file.path}`);
  }
  for (const file of plan.files) {
    const expected = decode(rollback ? file.before : file.after);
    if (!equal(await regularBytes(resolve(root, file.path)), expected)) {
      throw new Error(`Transaction result changed: ${file.path}; preserve unknown bytes.`);
    }
  }
  if (rollback) {
    for (const directory of [...(plan.directories ?? [])].reverse()) {
      await rmdir(resolve(root, directory));
      await syncDirectory(dirname(resolve(root, directory)));
    }
  } else {
    for (const directory of [...(plan.removeDirectories ?? [])].reverse()) {
      await rmdir(resolve(root, directory));
      await syncDirectory(dirname(resolve(root, directory)));
    }
  }
}

async function finish(root: string, expectedPlan: Uint8Array<ArrayBufferLike>|NonSharedBuffer) {
  const path = resolve(root, TRANSACTION_PATH);
  if (!(await regularBytes(path))?.equals(expectedPlan)) {
    throw new Error("Transaction plan changed; preserve it for explicit recovery.");
  }
  await unlink(path);
  await syncDirectory(dirname(path));
}

export async function stateTransaction(root: string, kind: TransactionPlan["kind"], files: TransactionFile[], {
  afterStep, validate, validateApplied, context, directories = [], removeDirectories = [],
}: TransactionOptions = {}) {
  const path = resolve(root, TRANSACTION_PATH);
  const plan = {
    kind, pid: process.pid, host: hostname(),
    ...(directories.length ? { directories } : {}),
    ...(removeDirectories.length ? { removeDirectories } : {}),
    ...(context === undefined ? {} : { context }),
    files: files.map(({ path, before, after }) => ({
      path, before: before === null ? null : Buffer.from(before).toString("base64"),
      after: after === null ? null : Buffer.from(after).toString("base64"),
    })),
  };
  const validatedPlan = validatePlan(plan);
  await checkParents(root, ".silvermoon/config.yaml");
  for (const file of plan.files) {
    await checkParents(
      root,
      [...directories, ...removeDirectories].includes(dirname(file.path))
        ? dirname(file.path)
        : file.path,
    );
    if (await regularBytes(resolve(root, `${file.path}.pending`)) !== null) {
      throw new Error(`Existing pending file at ${file.path}; preserve it and recover its original transaction.`);
    }
  }
  for (const directory of directories) {
    try {
      await lstat(resolve(root, directory));
      throw new Error(`Existing migration destination: ${directory}`);
    } catch (cause) {
      if (!hasErrorCode(cause, "ENOENT")) throw cause;
    }
  }
  for (const directory of removeDirectories) {
    const info = await lstat(resolve(root, directory));
    if (!info.isDirectory() || info.isSymbolicLink()) {
      throw new Error(`Irregular migration source directory: ${directory}`);
    }
  }
  const prepared = `${path}.${randomUUID()}.prepared`;
  const planSource = Buffer.from(`${JSON.stringify(plan)}\n`);
  await durableFile(prepared, planSource);
  try {
    // Publish a complete recovery plan and acquire the lock in one atomic step.
    await link(prepared, path);
  } finally {
    await unlink(prepared);
  }
  try {
    await syncDirectory(dirname(path));
    // Before taking any effect the entire source must still equal the requested old state.
    for (const file of plan.files) {
      await checkParents(
        root,
        [...directories, ...removeDirectories].includes(dirname(file.path))
          ? dirname(file.path)
          : file.path,
      );
      if (!equal(await regularBytes(resolve(root, file.path)), decode(file.before))) {
        throw new Error(`Stale transaction source: ${file.path}`);
      }
    }
    await validate?.();
    await afterStep?.("prepared");
    await applyPlan(root, validatedPlan, false, afterStep);
    await validateApplied?.();
    await afterStep?.("applied");
    await finish(root, planSource);
  } catch (cause) {
    throw new Error(
      `State transaction incomplete; preserve ${TRANSACTION_PATH} and use its explicit recovery command. Files may have changed: ${errorMessage(cause)}`,
      { cause },
    );
  }
}

export async function recoverStateTransaction(root: string, {
  rollback = false, confirmedStopped = false, kind, validate, validateRollback, validateApplied,
}: RecoveryOptions = {}) {
  if (!confirmedStopped) throw new Error("Recovery requires explicit confirmation that the original writer has stopped.");
  const path = resolve(root, TRANSACTION_PATH);
  const bytes = await regularBytes(path);
  if (bytes === null) throw new Error("No interrupted state transaction exists.");
  const parsed: unknown = JSON.parse(bytes.toString("utf8"));
  const plan = validatePlan(parsed);
  if (kind && plan.kind !== kind) throw new Error(`Use the ${plan.kind} recovery entrypoint for this transaction.`);
  if (plan.host !== hostname()) throw new Error("Recovery must run on the original writer host.");
  try {
    process.kill(plan.pid, 0);
    throw new Error("Original writer PID is still active; do not steal its lock.");
  } catch (error) {
    if (!hasErrorCode(error, "ESRCH")) throw error;
  }
  let recovery;
  try {
    recovery = await open(`${path}.recovery`, "wx");
  } catch (cause) {
    if (!hasErrorCode(cause, "EEXIST")) throw cause;
    throw new Error(
      `Recovery is already locked at ${TRANSACTION_PATH}.recovery. Preserve it; if its writer crashed, stop all recovery participants and explicitly inspect its PID and the exact transaction plan before removing only that recovery lock.`,
      { cause },
    );
  }
  try {
    await recovery.writeFile(`${process.pid}\n`);
    await recovery.sync();
    if (!(await regularBytes(path))?.equals(bytes)) throw new Error("Recovery plan changed before exclusive acquisition.");
    if (!rollback) await validate?.(plan);
    else await validateRollback?.(plan);
    await applyPlan(root, plan, rollback);
    if (!rollback) await validate?.(plan);
    if (!rollback) await validateApplied?.(plan);
    await finish(root, bytes);
  } finally {
    await recovery.close();
    const owner = await regularBytes(`${path}.recovery`);
    if (owner?.equals(Buffer.from(`${process.pid}\n`))) await unlink(`${path}.recovery`);
    else throw new Error("Recovery mutex changed; unknown bytes were preserved. The transaction may already be complete.");
  }
  return { kind: plan.kind, outcome: rollback ? "rolled-back" : "recovered" };
}
