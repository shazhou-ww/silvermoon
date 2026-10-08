import assert from "node:assert/strict";
import { test } from "node:test";

import {
  MAX_EVENT_BYTES,
  eventStorageChanges,
  gitContentDigest,
  storageDigest,
  validateEventRecordSizes,
} from "../../src/foundation/event-store/index.ts";
import { serializeIdeaEvents } from "../../src/foundation/event-codec/index.ts";
import type { EventStore } from "../../src/foundation/event-store/storage.ts";

const options = { objectIdLength: 40 };
const event = (sequence: number, message = String(sequence)) => ({
  sequence,
  type: "pong",
  payload: { message },
});
const bytes = (count: number) => Buffer.from(serializeIdeaEvents(
  Array.from({ length: count }, (_, index) => event(index + 1)),
));

function store(source: Buffer): EventStore {
  return {
    storage: "single-file",
    path: ".silvermoon/ideas/00000000000000000000000000/events.jsonl",
    bytes: source,
    entries: [],
    length: source.length,
    digest: gitContentDigest("blob", source, options),
  };
}

test("single-file digest covers exact raw bytes in both Git object formats", () => {
  const source = bytes(3);
  assert.match(gitContentDigest("blob", source, { objectIdLength: 40 }), /^[0-9a-f]{40}$/);
  assert.match(gitContentDigest("blob", source, { objectIdLength: 64 }), /^[0-9a-f]{64}$/);
  assert.notEqual(
    gitContentDigest("blob", source, options),
    gitContentDigest("blob", Buffer.concat([source, Buffer.from("\n")]), options),
  );
  assert.throws(
    () => gitContentDigest("blob", source, { objectIdLength: 41 }),
    /object ID length/,
  );
});

test("append planning replaces the complete authoritative file", () => {
  const source = bytes(2);
  const current = store(source);
  const record = Buffer.from(serializeIdeaEvents([event(3)]));
  const candidate = Buffer.concat([source, record]);
  const changes = eventStorageChanges(
    { eventsPath: current.path },
    current,
    candidate,
    options,
  );
  assert.deepEqual(changes, [{
    path: current.path,
    before: source,
    after: candidate,
  }]);
  assert.equal(
    storageDigest(current, candidate, options),
    gitContentDigest("blob", candidate, options),
  );
  const mutated = Buffer.from(candidate);
  mutated[mutated.length - 2] = 32;
  assert.notEqual(
    storageDigest(current, mutated, options),
    storageDigest(current, candidate, options),
  );
});

test("record size validation keeps the exact one MiB boundary", () => {
  const envelopeBytes = Buffer.byteLength(serializeIdeaEvents([event(1, "x")])) - 1;
  const maximum = Buffer.from(serializeIdeaEvents([
    event(1, "x".repeat(MAX_EVENT_BYTES - envelopeBytes)),
  ]));
  assert.equal(maximum.length, MAX_EVENT_BYTES);
  assert.doesNotThrow(() => validateEventRecordSizes(maximum));
  assert.throws(
    () => validateEventRecordSizes(Buffer.from(serializeIdeaEvents([
      event(1, "x".repeat(MAX_EVENT_BYTES - envelopeBytes + 1)),
    ]))),
    /exceeds 1048576/,
  );
});
