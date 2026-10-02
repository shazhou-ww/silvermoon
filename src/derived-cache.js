import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { closeSync, fsyncSync, linkSync, lstatSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const MAX_CACHE_BYTES = 16 * 1024 * 1024;

function regularFile(path) {
  try {
    const info = lstatSync(path);
    if (!info.isFile() || info.isSymbolicLink()
      || (process.platform !== "win32" && (info.mode & 0o077) !== 0)) {
      throw new Error(`Irregular or non-private derived event cache: ${path}`);
    }
    if (info.size > MAX_CACHE_BYTES) throw new Error(`Oversized derived event cache: ${path}`);
    return readFileSync(path);
  } catch (cause) {
    if (cause.code === "ENOENT") return null;
    throw cause;
  }
}

function durableTemporary(path, bytes) {
  const temporary = `${path}.${randomBytes(12).toString("hex")}.prepared`;
  const file = openSync(temporary, "wx", 0o600);
  try { writeFileSync(file, bytes); fsyncSync(file); }
  finally { closeSync(file); }
  return temporary;
}

export function openDerivedCache(directory) {
  for (const path of [resolve(directory, ".."), directory]) {
    try { mkdirSync(path, { mode: 0o700 }); }
    catch (cause) { if (cause.code !== "EEXIST") throw cause; }
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
    catch (cause) { if (cause.code !== "EEXIST") throw cause; }
    finally { unlinkSync(temporary); }
    key = regularFile(keyPath);
  }
  if (key?.length !== 32) throw new Error(`Invalid local event cache key; preserve and inspect ${keyPath}`);
  const pathFor = (context) => resolve(directory, `${createHash("sha256").update(context).digest("hex")}.json`);
  return {
    read(context) {
      const path = pathFor(context);
      const bytes = regularFile(path);
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
    },
    write(context, state) {
      const path = pathFor(context);
      const payload = JSON.stringify({ context, state });
      const temporary = durableTemporary(path, Buffer.from(JSON.stringify({
        payload, mac: createHmac("sha256", key).update(payload).digest("hex"),
      })));
      try { renameSync(temporary, path); }
      finally {
        try { unlinkSync(temporary); }
        catch (cause) { if (cause.code !== "ENOENT") throw cause; }
      }
    },
  };
}
