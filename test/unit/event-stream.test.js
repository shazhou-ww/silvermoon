import assert from "node:assert/strict";
import { test } from "node:test";

import {
  EVENTS_PER_SEGMENT, EventStream, MAX_EVENT_BYTES, segmentName,
} from "../../src/foundation/event-store/index.js";
import { serializeIdeaEvents } from "../../src/foundation/event-codec/index.js";
import { eventStorageChanges, storageDigest } from "../../src/foundation/event-store/index.js";

const options = { objectIdLength: 40 };
const event = (sequence, message = String(sequence)) => ({
  sequence, type: "pong", payload: { message },
});
const bytes = (count) => Buffer.from(serializeIdeaEvents(
  Array.from({ length: count }, (_, index) => event(index + 1)),
));

test("1000-event boundaries have a single deterministic representation", () => {
  assert.equal(EVENTS_PER_SEGMENT, 1000);
  for (const count of [0, 1, 999, 1000, 1001, 2000, 2001]) {
    const source = bytes(count);
    const stream = EventStream.fromBytes(source, options);
    const entries = stream.entries();
    assert.equal(entries.length, Math.max(1, Math.ceil(count / 1000)));
    assert.equal(stream.count, count);
    assert.equal(stream.length, source.length);
    assert.deepEqual(stream.bytes(), source);
    assert.equal(EventStream.fromSegments([...entries].reverse(), options).digest, stream.digest);
    for (let index = 0; index < entries.length; index++) {
      assert.equal(entries[index].name, segmentName(index + 1));
      assert.equal(entries[index].count, index < entries.length - 1 ? 1000 : count - index * 1000);
    }
  }
});

test("incremental append preserves sealed segments and equals full reconstruction", () => {
  let stream = EventStream.fromBytes(bytes(999), options);
  const original = stream;
  for (const count of [1000, 1001, 1002, 1003]) {
    stream = stream.append(Buffer.from(serializeIdeaEvents([event(count)])));
    assert.equal(stream.digest, EventStream.fromBytes(bytes(count), options).digest);
    assert.deepEqual(stream.bytes(), bytes(count));
    if (count > 1000) {
      assert.equal(stream.entries()[0].object, EventStream.fromBytes(bytes(1000), options).entries()[0].object);
    }
  }
  assert.equal(original.count, 999);
  assert.deepEqual(original.bytes(), bytes(999));
});

test("incremental aggregation hashes only tail bytes, not sealed history", () => {
  const work = [];
  const stream = EventStream.fromBytes(bytes(10000), {
    ...options, onHash: (entry) => work.push(entry),
  });
  work.length = 0;
  const record = Buffer.from(serializeIdeaEvents([event(10001)]));
  const next = stream.append(record);
  assert.deepEqual(work.filter(({ type }) => type === "blob"), [{ type: "blob", bytes: record.length }]);
  assert.equal(work.filter(({ type }) => type === "tree").length, 1);
  assert.equal(next.digest, EventStream.fromBytes(Buffer.concat([bytes(10000), record]), options).digest);
});

test("folder digest covers the entire history and exact retry prefixes", () => {
  const original = EventStream.fromBytes(bytes(1001), options);
  const changed = bytes(1001).toString("utf8").replace('"message":"1"', '"message":"x"');
  const other = EventStream.fromBytes(Buffer.from(changed), options);
  assert.equal(original.count, other.count);
  assert.equal(original.entries().at(-1).object, other.entries().at(-1).object);
  assert.notEqual(original.digest, other.digest);
  for (const count of [0, 1, 999, 1000, 1001]) {
    assert.equal(original.prefixDigest(bytes(count).length), EventStream.fromBytes(bytes(count), options).digest);
  }
  assert.throws(() => original.prefixDigest(1), /last record must end with LF/);
  assert.throws(() => original.prefixDigest(-1), /outside/);
  assert.throws(() => original.prefixDigest(original.length + 1), /outside/);
});

test("production append planning reuses verified segments and does not trust mutated candidates", () => {
  const source = bytes(1000);
  const baseline = EventStream.fromBytes(source, options);
  const store = { storage: "segmented", bytes: source, entries: baseline.entries() };
  const paths = { eventsDirectory: ".silvermoon/ideas/00000000000000000000000000/events" };
  const work = [];
  const observed = { ...options, onHash: (entry) => work.push(entry) };
  assert.equal(storageDigest(store, source, observed), baseline.digest);
  work.length = 0;
  const record = Buffer.from(serializeIdeaEvents([event(1001)]));
  const candidate = Buffer.concat([source, record]);
  const changes = eventStorageChanges(paths, store, candidate, observed);
  assert.equal(changes.length, 1);
  assert.equal(changes[0].path, `${paths.eventsDirectory}/${segmentName(2)}`);
  assert.equal(changes[0].before, null);
  assert.deepEqual(changes[0].after, record);
  const beforeMutation = storageDigest(store, candidate, observed);
  assert.deepEqual(work.filter(({ type }) => type === "blob"), [{ type: "blob", bytes: record.length }]);
  candidate[candidate.indexOf('"message":"1001"') + '"message":"'.length] = 120;
  assert.notEqual(storageDigest(store, candidate, observed), beforeMutation);
  source[0] = 0;
  assert.throws(() => storageDigest(store, source, options), /disagree/);
});

test("snapshots own their bytes and cannot accept forged summaries", () => {
  const source = bytes(1);
  const stream = EventStream.fromBytes(source, options);
  const expected = stream.digest;
  source.fill(0);
  const entries = stream.entries();
  entries[0].bytes.fill(0);
  stream.bytes().fill(0);
  assert.equal(stream.digest, expected);
  assert.deepEqual(stream.bytes(), bytes(1));
  assert.throws(() => new EventStream(null, [], options), /Use EventStream/);
});

test("rejects ambiguous layout, malformed content and oversized records", () => {
  const first = { name: segmentName(1), bytes: bytes(1) };
  assert.throws(() => EventStream.fromSegments([], options), /first segment/);
  assert.throws(() => EventStream.fromSegments([first, first], options), /must contain 1000/);
  assert.throws(() => EventStream.fromSegments([{ ...first, name: segmentName(2) }], options), /noncanonical/);
  assert.throws(() => EventStream.fromSegments([{ ...first, name: "1.jsonl" }], options), /noncanonical/);
  assert.throws(() => EventStream.fromSegments([
    { name: segmentName(1), bytes: bytes(1001) },
  ], options), /exceeds 1000/);
  assert.throws(() => EventStream.fromSegments([
    { name: segmentName(1), bytes: bytes(1000) },
    { name: segmentName(2), bytes: Buffer.alloc(0) },
  ], options), /empty segment/);
  assert.throws(() => EventStream.fromBytes(Buffer.from("bad\n"), options), /Invalid idea events/);
  assert.throws(() => EventStream.fromBytes(
    Buffer.from(serializeIdeaEvents([event(1, "x".repeat(MAX_EVENT_BYTES))])), options,
  ), /exceeds 1048576/);
  const envelopeBytes = Buffer.byteLength(serializeIdeaEvents([event(1, "x")])) - 1;
  const maximum = Buffer.from(serializeIdeaEvents([event(1, "x".repeat(MAX_EVENT_BYTES - envelopeBytes))]));
  assert.equal(maximum.length, MAX_EVENT_BYTES);
  assert.equal(EventStream.fromBytes(maximum, options).length, MAX_EVENT_BYTES);
  assert.throws(() => EventStream.fromBytes(Buffer.from(serializeIdeaEvents([
    event(1, "你".repeat(Math.ceil(MAX_EVENT_BYTES / 3))),
  ])), options), /exceeds 1048576/);
  assert.throws(() => EventStream.fromBytes(bytes(0), {}), /object ID length/);
  assert.throws(() => segmentName(0), /positive safe integer/);
  assert.throws(() => EventStream.fromBytes(bytes(0), options).append(bytes(2)), /exactly one/);
  assert.throws(() => EventStream.fromBytes(bytes(0), options).append(
    Buffer.from(serializeIdeaEvents([event(2)])),
  ), /continue/);
});
