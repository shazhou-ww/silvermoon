import { createHash } from "node:crypto";

import { IdeaEventFormatError } from "../event-codec/index.ts";

export const MAX_EVENT_BYTES = 1024 * 1024;

export interface EventDigestOptions {
  objectIdLength: number;
}

/** @pure */
export function algorithm({ objectIdLength }: EventDigestOptions) {
  if (![40, 64].includes(objectIdLength)) {
    throw new TypeError("Event stream digest requires the repository's Git object ID length.");
  }
  return objectIdLength === 64 ? "sha256" : "sha1";
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
export function validateEventRecordSizes(bytes: unknown) {
  if (!Buffer.isBuffer(bytes)) {
    throw new TypeError("Event log validation requires raw bytes.");
  }
  let start = 0;
  while (start < bytes.length) {
    const newline = bytes.indexOf(10, start);
    if (newline < 0) break;
    const length = newline + 1 - start;
    if (length > MAX_EVENT_BYTES) {
      throw new IdeaEventFormatError(
        `event record exceeds ${MAX_EVENT_BYTES} bytes including LF`,
        undefined,
      );
    }
    start = newline + 1;
  }
}
