import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { closeSync, fsyncSync, linkSync, lstatSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const MAX_CACHE_BYTES = 16 * 1024 * 1024;

function hasErrorCode(cause: unknown, code: string) {
  return cause instanceof Error && "code" in cause && cause.code === code;
}

function regularFile(path: string) {
  try {
    const info = lstatSync(path);
    if (!info.isFile() || info.isSymbolicLink()
      || (process.platform !== "win32" && (info.mode & 0o077) !== 0)) {
      throw new Error(`Irregular or non-private derived event cache: ${path}`);
    }
    if (info.size > MAX_CACHE_BYTES) throw new Error(`Oversized derived event cache: ${path}`);
    return readFileSync(path);
  } catch (cause) {
    if (hasErrorCode(cause, "ENOENT")) return null;
    throw cause;
  }
}

function durableTemporary(path: string, bytes: string|NodeJS.ArrayBufferView<ArrayBufferLike>|Buffer<ArrayBuffer>) {
  const temporary = `${path}.${randomBytes(12).toString("hex")}.prepared`;
  const file = openSync(temporary, "wx", 0o600);
  try { writeFileSync(file, bytes); fsyncSync(file); }
  finally { closeSync(file); }
  return temporary;
}

export function openDerivedCache(directory: string) {
  for (const path of [resolve(directory, ".."), directory]) {
    try { mkdirSync(path, { mode: 0o700 }); }
    catch (cause) { if (!hasErrorCode(cause, "EEXIST")) throw cause; }
    const info = lstatSync(path);
    if (!info.isDirectory() || info.isSymbolicLink()
      || (process.platform !== "win32" && (info.mode & 0o077) !== 0)) {
      throw new Error("Derived cache must be a regular private directory.");
    }
  }
  const keyPath = resolve(directory, "key");
  let key = regularFile(keyPath);
  if (key === null) {
    const temporary = durableTemporary(keyPath, randomBytes(32));
    try { linkSync(temporary, keyPath); }
    catch (cause) { if (!hasErrorCode(cause, "EEXIST")) throw cause; }
    finally { unlinkSync(temporary); }
    key = regularFile(keyPath);
  }
  if (key?.length !== 32) throw new Error(`Invalid local event cache key; preserve and inspect ${keyPath}`);
  const pathFor = (context: string|NodeJS.ArrayBufferView<ArrayBufferLike>) => resolve(directory, `${createHash("sha256").update(context).digest("hex")}.json`);
  return {
    read(context: string) {
      const path = pathFor(context);
      const bytes = regularFile(path);
      if (bytes === null) return null;
      const record: unknown = JSON.parse(bytes.toString("utf8"));
      if (typeof record !== "object" || record === null
        || !("payload" in record) || typeof record.payload !== "string"
        || !("mac" in record) || typeof record.mac !== "string"
        || !/^[0-9a-f]{64}$/.test(record.mac)) {
        throw new Error(`Invalid derived event cache; remove only this disposable cache file: ${path}`);
      }
      const expected = createHmac("sha256", key).update(record.payload).digest();
      if (!timingSafeEqual(expected, Buffer.from(record.mac, "hex"))) {
        throw new Error(`Unauthenticated derived event cache; remove only this disposable cache file: ${path}`);
      }
      const summary: unknown = JSON.parse(record.payload);
      if (typeof summary !== "object" || summary === null
        || !("context" in summary) || summary.context !== context
        || !("state" in summary)) {
        throw new Error(`Derived cache source mismatch: ${path}`);
      }
      return summary.state;
    },
    write(context: string, state: unknown) {
      const path = pathFor(context);
      const payload = JSON.stringify({ context, state });
      const temporary = durableTemporary(path, Buffer.from(JSON.stringify({
        payload, mac: createHmac("sha256", key).update(payload).digest("hex"),
      })));
      try { renameSync(temporary, path); }
      finally {
        try { unlinkSync(temporary); }
        catch (cause) { if (!hasErrorCode(cause, "ENOENT")) throw cause; }
      }
    },
  };
}
