import { createHash, randomUUID } from "node:crypto";
import { hostname } from "node:os";
import { dirname, resolve } from "node:path";
import { link, lstat, open, readFile, rename, unlink } from "node:fs/promises";

import { isValidUlid } from "./ideas.js";

export const TRANSACTION_PATH = ".silvermoon/transaction";
export const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");

export async function regularBytes(path) {
  try {
    const metadata = await lstat(path);
    if (!metadata.isFile() || metadata.isSymbolicLink()) throw new Error(`Not a regular file: ${path}`);
    return await readFile(path);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function durableFile(path, bytes) {
  const file = await open(path, "wx");
  try {
    await file.writeFile(bytes);
    await file.sync();
  } finally {
    await file.close();
  }
}

async function syncDirectory(path) {
  // Node cannot fsync directory handles on Windows; files are synced before rename.
  if (process.platform === "win32") return;
  const directory = await open(path, "r");
  try { await directory.sync(); } finally { await directory.close(); }
}

function allowedPath(path) {
  if (path === ".silvermoon/config.yaml") return true;
  const match = /^\.silvermoon\/ideas\/([^/]+)\/(status\.yaml|events\.jsonl)$/.exec(path);
  return match !== null && isValidUlid(match[1]);
}

async function checkParents(root, path) {
  const parts = path.split("/").slice(0, -1);
  for (let index = 1; index <= parts.length; index++) {
    const parent = await lstat(resolve(root, ...parts.slice(0, index)));
    if (!parent.isDirectory() || parent.isSymbolicLink()) throw new Error(`Irregular transaction parent: ${path}`);
  }
}

export async function stateBytes(root, path) {
  if (!allowedPath(path)) throw new Error(`Unsupported state path: ${path}`);
  await checkParents(root, path);
  return regularBytes(resolve(root, path));
}

function decode(value) {
  if (value === null) return null;
  if (typeof value !== "string" || Buffer.from(value, "base64").toString("base64") !== value) {
    throw new Error("Transaction backup is not canonical base64.");
  }
  return Buffer.from(value, "base64");
}

function equal(left, right) {
  return left === null || right === null ? left === right : left.equals(right);
}

function validatePlan(plan) {
  if (!["events", "migration"].includes(plan?.kind) || !Array.isArray(plan.files)
    || !Number.isSafeInteger(plan.pid) || plan.pid < 1 || typeof plan.host !== "string") {
    throw new Error("Invalid state transaction plan; preserve it for manual recovery.");
  }
  const paths = new Set();
  for (const file of plan.files) {
    if (!allowedPath(file.path) || paths.has(file.path)) throw new Error("Unsafe or repeated transaction path.");
    paths.add(file.path);
    decode(file.before);
    decode(file.after);
  }
}

async function applyPlan(root, plan, rollback, afterStep) {
  validatePlan(plan);
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
}

async function finish(root, expectedPlan) {
  const path = resolve(root, TRANSACTION_PATH);
  if (!(await regularBytes(path))?.equals(expectedPlan)) {
    throw new Error("Transaction plan changed; preserve it for explicit recovery.");
  }
  await unlink(path);
  await syncDirectory(dirname(path));
}

export async function stateTransaction(root, kind, files, { afterStep, validate, context } = {}) {
  const path = resolve(root, TRANSACTION_PATH);
  const plan = {
    kind, pid: process.pid, host: hostname(),
    ...(context === undefined ? {} : { context }),
    files: files.map(({ path, before, after }) => ({
      path, before: before === null ? null : Buffer.from(before).toString("base64"),
      after: after === null ? null : Buffer.from(after).toString("base64"),
    })),
  };
  validatePlan(plan);
  await checkParents(root, ".silvermoon/config.yaml");
  for (const file of plan.files) {
    await checkParents(root, file.path);
    if (await regularBytes(resolve(root, `${file.path}.pending`)) !== null) {
      throw new Error(`Existing pending file at ${file.path}; preserve it and recover its original transaction.`);
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
      await checkParents(root, file.path);
      if (!equal(await regularBytes(resolve(root, file.path)), decode(file.before))) {
        throw new Error(`Stale transaction source: ${file.path}`);
      }
    }
    await validate?.();
    await afterStep?.("prepared");
    await applyPlan(root, plan, false, afterStep);
    await afterStep?.("applied");
    await finish(root, planSource);
  } catch (cause) {
    throw new Error(
      `State transaction incomplete; preserve ${TRANSACTION_PATH} and use its explicit recovery command. Files may have changed: ${cause.message}`,
      { cause },
    );
  }
}

export async function recoverStateTransaction(root, {
  rollback = false, confirmedStopped = false, kind, validate, validateRollback,
} = {}) {
  if (!confirmedStopped) throw new Error("Recovery requires explicit confirmation that the original writer has stopped.");
  const path = resolve(root, TRANSACTION_PATH);
  const bytes = await regularBytes(path);
  if (bytes === null) throw new Error("No interrupted state transaction exists.");
  const plan = JSON.parse(bytes.toString("utf8"));
  validatePlan(plan);
  if (kind && plan.kind !== kind) throw new Error(`Use the ${plan.kind} recovery entrypoint for this transaction.`);
  if (plan.host !== hostname()) throw new Error("Recovery must run on the original writer host.");
  try {
    process.kill(plan.pid, 0);
    throw new Error("Original writer PID is still active; do not steal its lock.");
  } catch (error) {
    if (error.code !== "ESRCH") throw error;
  }
  let recovery;
  try {
    recovery = await open(`${path}.recovery`, "wx");
  } catch (cause) {
    if (cause.code !== "EEXIST") throw cause;
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
    await finish(root, bytes);
  } finally {
    await recovery.close();
    const owner = await regularBytes(`${path}.recovery`);
    if (owner?.equals(Buffer.from(`${process.pid}\n`))) await unlink(`${path}.recovery`);
    else throw new Error("Recovery mutex changed; unknown bytes were preserved. The transaction may already be complete.");
  }
  return { kind: plan.kind, outcome: rollback ? "rolled-back" : "recovered" };
}
