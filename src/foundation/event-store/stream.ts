import {
  algorithm,
  eventFolderBytes,
  EVENTS_PER_SEGMENT,
  MAX_EVENT_BYTES,
  gitContentDigest as pureContentDigest,
  segmentName,
} from "./digest.ts";
import { IdeaEventFormatError, parseIdeaEvents } from "../event-codec/index.ts";

export { EVENTS_PER_SEGMENT, MAX_EVENT_BYTES, segmentName } from "./digest.ts";
export const EVENT_STREAM_DIRECTORY = "events";
const OWNED_SNAPSHOT = Symbol("verified-event-stream");

export interface EventStreamOptions {
  objectIdLength: number;
  legacy?: boolean;
  onHash?: (entry: { type: string; bytes: number }) => unknown;
}

export interface EventSegmentInput {
  name: string;
  bytes: Buffer;
}

export interface EventSegment extends EventSegmentInput {
  count: number;
  object: string;
}

export interface EventSegmentChange {
  name: string;
  before: Buffer | null;
  after: Buffer | null;
}

function formatError(message: string): IdeaEventFormatError {
  return new IdeaEventFormatError(message, undefined);
}

function isSegmentInput(value: unknown): value is EventSegmentInput {
  if (value === null || typeof value !== "object") return false;
  return "name" in value && typeof value.name === "string"
    && "bytes" in value && Buffer.isBuffer(value.bytes);
}

function eventSequence(bytes: Buffer): number | undefined {
  const parsed: unknown = JSON.parse(bytes.toString("utf8"));
  if (parsed === null || typeof parsed !== "object" || !("sequence" in parsed)) return undefined;
  return typeof parsed.sequence === "number" ? parsed.sequence : undefined;
}

export function gitContentDigest(type: string, bytes: unknown, options: Readonly<EventStreamOptions>) {
  if (!["blob", "tree"].includes(type) || !Buffer.isBuffer(bytes)) {
    throw new TypeError("Git content digest requires a blob/tree and raw bytes.");
  }
  options.onHash?.({ type, bytes: bytes.length });
  return pureContentDigest(type, bytes, options);
}

export function eventFolderDigest(
  segments: readonly { name: string; object: string }[],
  options: Readonly<EventStreamOptions>,
) {
  return gitContentDigest("tree", eventFolderBytes(segments, options), options);
}

function treeDigest(segments: readonly EventSegment[], options: Readonly<EventStreamOptions>) {
  return eventFolderDigest(segments.map(({ object }, index) => ({
    name: segmentName(index + 1),
    object,
  })), options);
}

function records(bytes: unknown, options: Readonly<EventStreamOptions>) {
  if (!Buffer.isBuffer(bytes)) throw new TypeError("Event segments require raw bytes.");
  const events = parseIdeaEvents(bytes, options);
  let start = 0;
  const lines: Buffer[] = [];
  for (const event of events) {
    const end = bytes.indexOf(10, start) + 1;
    if (end - start > MAX_EVENT_BYTES) {
      const sequence = event !== null && typeof event === "object" && "sequence" in event
        ? event.sequence
        : "unknown";
      throw formatError(`event ${String(sequence)} exceeds ${MAX_EVENT_BYTES} bytes including LF`);
    }
    lines.push(bytes.subarray(start, end));
    start = end;
  }
  return lines;
}

function verifiedSegment(bytes: unknown, options: Readonly<EventStreamOptions>): Readonly<EventSegment> {
  const lines = records(bytes, options);
  if (!Buffer.isBuffer(bytes)) throw new TypeError("Event segments require raw bytes.");
  if (lines.length > EVENTS_PER_SEGMENT) {
    throw formatError(`segment exceeds ${EVENTS_PER_SEGMENT} events`);
  }
  const owned = Buffer.from(bytes);
  return Object.freeze({
    name: "",
    bytes: owned,
    count: lines.length,
    object: gitContentDigest("blob", owned, options),
  });
}

export class EventStream {
  readonly #segments: readonly Readonly<EventSegment>[];
  readonly #options: Readonly<EventStreamOptions>;
  readonly length: number;
  readonly count: number;
  readonly digest: string;

  private constructor(
    token: typeof OWNED_SNAPSHOT,
    segments: readonly Readonly<EventSegment>[],
    options: EventStreamOptions,
  ) {
    if (token !== OWNED_SNAPSHOT) throw new TypeError("Use EventStream.fromBytes or fromSegments.");
    algorithm(options);
    this.#segments = segments;
    this.#options = Object.freeze({ ...options });
    this.length = segments.reduce((total, { bytes }) => total + bytes.length, 0);
    this.count = segments.reduce((total, segment) => total + segment.count, 0);
    if (!Number.isSafeInteger(this.length) || !Number.isSafeInteger(this.count)) {
      throw new RangeError("Event stream exceeds safe integer addressing.");
    }
    this.digest = treeDigest(segments, options);
    Object.freeze(this);
  }

  static fromBytes(bytes: unknown, options: EventStreamOptions) {
    algorithm(options);
    const lines = records(bytes, options);
    const segments: Readonly<EventSegment>[] = [];
    for (let index = 0; index < lines.length; index += EVENTS_PER_SEGMENT) {
      segments.push(verifiedSegment(
        Buffer.concat(lines.slice(index, index + EVENTS_PER_SEGMENT)),
        options,
      ));
    }
    if (!segments.length) segments.push(verifiedSegment(Buffer.alloc(0), options));
    return new EventStream(OWNED_SNAPSHOT, segments, options);
  }

  static fromSegments(entries: unknown, options: EventStreamOptions) {
    algorithm(options);
    if (!Array.isArray(entries) || !entries.length || !entries.every(isSegmentInput)) {
      throw formatError("stream requires at least its first segment, including when empty");
    }
    const sorted = [...entries].sort((left, right) =>
      Buffer.compare(Buffer.from(left.name), Buffer.from(right.name)));
    const segments = sorted.map(({ name, bytes }, index) => {
      if (name !== segmentName(index + 1)) {
        throw formatError(`missing, repeated or noncanonical segment at ${name}`);
      }
      const segment = verifiedSegment(bytes, options);
      if (index < sorted.length - 1 && segment.count !== EVENTS_PER_SEGMENT) {
        throw formatError(`non-tail segment ${name} must contain ${EVENTS_PER_SEGMENT} events`);
      }
      if (segment.count === 0 && sorted.length !== 1) {
        throw formatError("only an identity-only stream may have an empty segment");
      }
      return segment;
    });
    return new EventStream(OWNED_SNAPSHOT, segments, options);
  }

  entries(): EventSegment[] {
    return this.#segments.map(({ bytes, object, count }, index) => ({
      name: segmentName(index + 1),
      bytes: Buffer.from(bytes),
      object,
      count,
    }));
  }

  changesSince(previous: EventStream): EventSegmentChange[] {
    if (!(previous instanceof EventStream)
      || previous.#options.objectIdLength !== this.#options.objectIdLength) {
      throw new TypeError("Segment changes require a verified snapshot in the same Git object format.");
    }
    const changes: EventSegmentChange[] = [];
    for (let index = 0; index < Math.max(this.#segments.length, previous.#segments.length); index++) {
      const before = previous.#segments[index];
      const after = this.#segments[index];
      if (before?.object === after?.object) continue;
      changes.push({
        name: segmentName(index + 1),
        before: before ? Buffer.from(before.bytes) : null,
        after: after ? Buffer.from(after.bytes) : null,
      });
    }
    return changes;
  }

  bytes() {
    return Buffer.concat(this.#segments.map(({ bytes }) => bytes));
  }

  append(record: unknown) {
    if (!Buffer.isBuffer(record) || records(record, this.#options).length !== 1) {
      throw formatError("append requires exactly one canonical event record");
    }
    const segments = [...this.#segments];
    const tail = segments.at(-1);
    if (!tail) throw new Error("Verified event stream is missing its identity segment.");
    if (eventSequence(record) !== this.count + 1) {
      throw formatError("append sequence must continue the logical stream");
    }
    if (tail.count === EVENTS_PER_SEGMENT) {
      segments.push(verifiedSegment(record, this.#options));
    } else {
      segments[segments.length - 1] = verifiedSegment(
        Buffer.concat([tail.bytes, record]),
        this.#options,
      );
    }
    return new EventStream(OWNED_SNAPSHOT, segments, this.#options);
  }

  prefixDigest(length: unknown) {
    if (typeof length !== "number"
      || !Number.isSafeInteger(length) || length < 0 || length > this.length) {
      throw new RangeError("Prefix length is outside the event stream.");
    }
    if (length === this.length) return this.digest;
    if (length === 0) {
      return treeDigest([verifiedSegment(Buffer.alloc(0), this.#options)], this.#options);
    }
    const prefix: Readonly<EventSegment>[] = [];
    let remaining = length;
    for (const segment of this.#segments) {
      if (remaining >= segment.bytes.length) {
        prefix.push(segment);
        remaining -= segment.bytes.length;
      } else {
        const partial = segment.bytes.subarray(0, remaining);
        prefix.push(verifiedSegment(partial, this.#options));
        remaining = 0;
      }
      if (remaining === 0) break;
    }
    return treeDigest(prefix, this.#options);
  }
}
