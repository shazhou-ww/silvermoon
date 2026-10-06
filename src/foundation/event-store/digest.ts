import { createHash } from "node:crypto";

import { IdeaEventFormatError } from "../event-codec/index.ts";

export const EVENTS_PER_SEGMENT = 1000;
export const MAX_EVENT_BYTES = 1024 * 1024;

export interface EventDigestOptions {
  objectIdLength: number;
}

export interface EventFolderEntry {
  name: string;
  object: string;
}

/** @pure */
export function algorithm({ objectIdLength }: EventDigestOptions) {
  if (![40, 64].includes(objectIdLength)) {
    throw new TypeError("Event stream digest requires the repository's Git object ID length.");
  }
  return objectIdLength === 64 ? "sha256" : "sha1";
}

/** @pure */
export function segmentName(ordinal: unknown) {
  if (typeof ordinal !== "number" || !Number.isSafeInteger(ordinal) || ordinal < 1) {
    throw new TypeError("Segment ordinal must be a positive safe integer.");
  }
  return `${String(ordinal).padStart(16, "0")}.jsonl`;
}

/** @pure */
export function gitContentDigest(type: string, bytes: unknown, options: EventDigestOptions) {
  if (!["blob", "tree"].includes(type) || !Buffer.isBuffer(bytes)) {
    throw new TypeError("Git content digest requires a blob/tree and raw bytes.");
  }
  return createHash(algorithm(options))
    .update(`${type} ${bytes.length}\0`)
    .update(bytes)
    .digest("hex");
}

/** @pure */
export function eventFolderBytes(
  segments: readonly EventFolderEntry[],
  options: EventDigestOptions,
) {
  algorithm(options);
  const sorted = [...segments].sort((left, right) =>
    Buffer.compare(Buffer.from(left.name), Buffer.from(right.name)));
  const entries = sorted.map(({ name, object }, index) => {
    if (name !== segmentName(index + 1)
      || !new RegExp(`^[0-9a-f]{${options.objectIdLength}}$`).test(object)) {
      throw new IdeaEventFormatError(
        "folder digest requires a complete canonical segment table",
        undefined,
      );
    }
    return Buffer.concat([
      Buffer.from(`100644 ${name}\0`),
      Buffer.from(object, "hex"),
    ]);
  });
  if (!entries.length) {
    throw new IdeaEventFormatError("folder digest requires its first segment", undefined);
  }
  return Buffer.concat(entries);
}

/** @pure */
export function eventFolderDigest(
  segments: readonly EventFolderEntry[],
  options: EventDigestOptions,
) {
  return gitContentDigest("tree", eventFolderBytes(segments, options), options);
}
