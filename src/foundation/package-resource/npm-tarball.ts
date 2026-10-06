import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import type { InputType } from "node:zlib";

function digest(
  algorithm: string,
  bytes: string | NodeJS.ArrayBufferView<ArrayBufferLike>,
  encoding: "base64" | "hex",
) {
  return createHash(algorithm).update(bytes).digest(encoding);
}

function readTarString(buffer: Buffer<ArrayBufferLike>, offset: number, length: number) {
  const field = buffer.subarray(offset, offset + length);
  const end = field.indexOf(0);
  return field.subarray(0, end === -1 ? field.length : end).toString("utf8");
}

function readTarSize(buffer: Buffer<ArrayBufferLike>, offset: number) {
  const field = readTarString(buffer, offset, 12).trim();
  if (!/^[0-7]+$/.test(field)) {
    throw new Error(`Unsupported tar entry size: ${field || "(empty)"}.`);
  }
  return Number.parseInt(field, 8);
}

function parsePaxHeader(buffer: Buffer<ArrayBufferLike>) {
  const values: Record<string, string> = {};
  let offset = 0;
  while (offset < buffer.length) {
    const separator = buffer.indexOf(0x20, offset);
    if (separator === -1) throw new Error("Malformed PAX header length.");
    const length = Number.parseInt(
      buffer.subarray(offset, separator).toString("ascii"),
      10,
    );
    if (!Number.isSafeInteger(length) || length <= 0 || offset + length > buffer.length) {
      throw new Error("Malformed PAX header record.");
    }
    const record = buffer
      .subarray(separator + 1, offset + length - 1)
      .toString("utf8");
    const equals = record.indexOf("=");
    if (equals === -1) throw new Error("Malformed PAX header value.");
    values[record.slice(0, equals)] = record.slice(equals + 1);
    offset += length;
  }
  return values;
}

export function readNpmTarballEntries(tarballBytes: NonSharedBuffer|InputType) {
  let archive: Buffer;
  try {
    archive = gunzipSync(tarballBytes);
  } catch (error) {
    throw new Error(
      `Could not decompress npm tarball: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const entries = new Map<string, Buffer>();
  let offset = 0;
  let pendingPath: string | undefined;
  while (offset + 512 <= archive.length) {
    const header = archive.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;

    const name = readTarString(header, 0, 100);
    const prefix = readTarString(header, 345, 155);
    const headerPath = prefix ? `${prefix}/${name}` : name;
    const type = String.fromCharCode(header[156] || 0);
    const size = readTarSize(header, 124);
    const contentStart = offset + 512;
    const contentEnd = contentStart + size;
    if (contentEnd > archive.length) {
      throw new Error(`Truncated tar entry: ${headerPath}.`);
    }
    const content = archive.subarray(contentStart, contentEnd);
    offset = contentStart + Math.ceil(size / 512) * 512;

    if (type === "x") {
      pendingPath = parsePaxHeader(content).path;
      continue;
    }
    if (type === "L") {
      pendingPath = readTarString(content, 0, content.length);
      continue;
    }

    const path = pendingPath ?? headerPath;
    pendingPath = undefined;
    if (type !== "\0" && type !== "0") continue;
    if (!path.startsWith("package/")) {
      throw new Error(`Unexpected npm tarball path: ${path}.`);
    }
    const packagePath = path.slice("package/".length);
    if (!packagePath || entries.has(packagePath)) {
      throw new Error(`Duplicate or empty npm tarball path: ${path}.`);
    }
    entries.set(packagePath, Buffer.from(content));
  }
  if (entries.size === 0) {
    throw new Error("npm tarball does not contain package files.");
  }
  return entries;
}

export function requiredEntry(entries: ReadonlyMap<string, Buffer>, path: string) {
  const entry = entries.get(path);
  if (!entry) throw new Error(`npm tarball is missing ${path}.`);
  return entry;
}

export async function inspectNpmTarball(tarballPath: string) {
  const resolvedPath = resolve(tarballPath);
  const bytes = await readFile(resolvedPath);
  const entries = readNpmTarballEntries(bytes);
  let manifest;
  try {
    manifest = JSON.parse(requiredEntry(entries, "package.json").toString("utf8"));
  } catch (error) {
    throw new Error(
      `Could not parse package.json from npm tarball: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  return {
    bytes,
    entries,
    fileCount: entries.size,
    integrity: `sha512-${digest("sha512", bytes, "base64")}`,
    manifest,
    sha256: digest("sha256", bytes, "hex"),
    sha512: digest("sha512", bytes, "hex"),
    shasum: digest("sha1", bytes, "hex"),
    tarballPath: resolvedPath,
  };
}
