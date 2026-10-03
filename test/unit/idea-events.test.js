import assert from "node:assert/strict";
import { test } from "node:test";

import {
  EVENT_PERMISSIONS, EVENT_RENAMES, IDEA_EVENT_TYPES,
  checkEventChange, eventsFromStatus, initialEventState, parseIdeaEvents,
  reduceIdeaEvent, replayIdeaEvents, serializeIdeaEvents,
} from "../../src/events/rules/grammar.js";
import { deriveIdeaState } from "../../src/idea/rules/status.js";

const id = "01M3SJTKFRQ19DP0RPPJACKGMC";
const revisions = {
  idealRevision: "1".repeat(40),
  implementationRevision: "2".repeat(40),
  deploymentRevision: "3".repeat(40),
};
const alias = (sequence, value) => ({
  sequence, type: "setAlias", payload: { alias: value },
});

test("internal legacy conversion retains status and final v2 retains ordered interaction", () => {
  const options = { legacy: true };
  const legacy = [
    { sequence: 1, type: "alias.updated", payload: { alias: "example" } },
    { sequence: 2, type: "ideal.approved", payload: { idealRevision: revisions.idealRevision } },
    { sequence: 3, type: "idea.abandoned" },
    { sequence: 4, type: "idea.resumed" },
  ];
  const migrated = legacy.map((event) => ({ ...event, type: EVENT_RENAMES[event.type] }));
  assert.equal(IDEA_EVENT_TYPES.length, 9);
  assert.equal(EVENT_PERMISSIONS.acceptIdeal, "upstream");
  assert.equal(EVENT_PERMISSIONS.ping, "upstream");
  assert.equal(EVENT_PERMISSIONS.pong, "downstream");
  assert.equal(EVENT_PERMISSIONS.setAlias, "both");
  assert.deepEqual(replayIdeaEvents(id, migrated).state.status,
    replayIdeaEvents(id, legacy, options).state.status);
  const messages = [
    { sequence: 5, type: "pong", payload: { message: "blocked" } },
    { sequence: 6, type: "ping", payload: { message: "new objective" } },
    { sequence: 7, type: "pong", payload: { message: "still blocked" } },
    { sequence: 8, type: "pong", payload: { message: "waiting" } },
  ];
  const events = [...migrated, ...messages];
  assert.deepEqual(parseIdeaEvents(serializeIdeaEvents(events)), events);
  assert.deepEqual(replayIdeaEvents(id, events).state.interaction, {
    messages: messages.map(({ sequence, type, payload }) => ({
      sequence, type, message: payload.message,
    })),
    lastSignal: "pong",
  });
  assert.equal(replayIdeaEvents(id, events).state.status.approvedRevision,
    revisions.idealRevision);
  for (const invalid of [
    { sequence: 1, type: "ping", payload: { message: " " } },
    { sequence: 1, type: "pong", payload: { message: "", outcome: "blocked" } },
    { sequence: 1, type: "alias.updated", payload: { alias: "old" } },
  ]) assert.throws(() => serializeIdeaEvents([invalid]), /Invalid idea events/);
  assert.throws(() => parseIdeaEvents(serializeIdeaEvents(migrated), options), /Invalid idea events/);
});

test("final v2 abandoned state accepts only resume, including metadata and messages", () => {
  const options = {};
  const abandoned = replayIdeaEvents(id, [{ sequence: 1, type: "abandon" }], options).state;
  for (const event of [
    { sequence: 2, type: "ping", payload: { message: "continue" } },
    { sequence: 2, type: "pong", payload: { message: "blocked" } },
    { sequence: 2, type: "setAlias", payload: { alias: "new-alias" } },
    { sequence: 2, type: "acceptIdeal", payload: { idealRevision: revisions.idealRevision } },
    { sequence: 2, type: "abandon" },
  ]) assert.equal(reduceIdeaEvent(abandoned, event, options).code, "abandoned");
  assert.equal(reduceIdeaEvent(abandoned, { sequence: 2, type: "resume" }, options).ok, true);
});

test("serializes a minimal seven-event log and replays without mutating inputs", () => {
  const events = [
    alias(1, "example"),
    { sequence: 2, type: "setLanguage", payload: { language: "zh-CN" } },
    { sequence: 3, type: "acceptIdeal", payload: { idealRevision: revisions.idealRevision } },
    { sequence: 4, type: "acceptInner", payload: { implementationRevision: revisions.implementationRevision } },
    { sequence: 5, type: "acceptOuter", payload: { deploymentRevision: revisions.deploymentRevision } },
    { sequence: 6, type: "abandon" },
    { sequence: 7, type: "resume" },
    alias(8, null),
    { sequence: 9, type: "setLanguage", payload: { language: null } },
  ];
  const saved = structuredClone(events);
  const source = serializeIdeaEvents(events);
  assert.deepEqual(parseIdeaEvents(Buffer.from(source)), events);
  const result = replayIdeaEvents(id, events);
  assert.equal(result.ok, true);
  assert.equal(deriveIdeaState(revisions, { version: 1, ...result.state.status }), "completed");
  assert.equal(result.state.sequence, 9);
  assert.equal(result.state.status.alias, undefined);
  assert.equal(result.state.status.language, undefined);
  assert.deepEqual(events, saved);
  assert.deepEqual(replayIdeaEvents(id, []), { ok: true, state: initialEventState(id) });
});

test("rejects malformed or noncanonical logs rather than treating them as repairable", () => {
  const valid = serializeIdeaEvents([alias(1, "a")]);
  for (const source of [
    valid.trimEnd(), `\uFEFF${valid}`, valid.replace("\n", "\r\n"), "\n",
    '{"sequence":1,"sequence":1,"type":"abandon"}\n',
    '{"type":"abandon","sequence":1}\n',
    '{"sequence":1,"type":"idea.created"}\n',
    '{"sequence":1,"type":"abandon","payload":{}}\n',
    '{"sequence":0,"type":"abandon"}\n',
    '{"sequence":1.5,"type":"abandon"}\n',
    '{"sequence":1,"type":"acceptIdeal","payload":{"idealRevision":null}}\n',
    '{"sequence":1,"type":"setAlias","payload":{"alias":" leading"}}\n',
    '{"sequence":1,"type":"setLanguage","payload":{"language":"zh-cn"}}\n',
    '{"sequence":1,"type":"setAlias","payload":{"alias":"a","alias":"a"}}\n',
    Buffer.from([0xff, 10]),
  ]) {
    assert.throws(() => parseIdeaEvents(source), /Invalid idea events/);
    assert.throws(() => checkEventChange(id, source, valid), /Invalid idea events/);
  }
});

test("failed transitions preserve state and never consume a sequence", () => {
  const state = replayIdeaEvents(id, [alias(1, "a")]).state;
  for (const [event, code] of [
    [alias(2, "a"), "no-state-change"],
    [alias(3, "b"), "sequence-conflict"],
    [alias(1, "b"), "sequence-conflict"],
    [{ sequence: 2, type: "resume" }, "no-state-change"],
  ]) {
    const before = structuredClone(state);
    assert.deepEqual(reduceIdeaEvent(state, event), { ok: false, code, sequence: event.sequence });
    assert.deepEqual(state, before);
  }
});

test("only a definite base reduction failure permits repair, and protection returns", () => {
  const good = serializeIdeaEvents([alias(1, "a")]);
  const changed = serializeIdeaEvents([alias(1, "b")]);
  const bad = serializeIdeaEvents([alias(1, "a"), alias(2, "a")]);
  assert.equal(checkEventChange(id, good, changed).code, "not-append-only");
  assert.equal(checkEventChange(id, good, "").code, "not-append-only");
  assert.equal(checkEventChange(id, good, bad).code, "no-state-change");
  assert.equal(checkEventChange(id, bad, good).mode, "repair");
  assert.equal(checkEventChange(id, bad, good).ok, true);
  assert.equal(checkEventChange(id, good, changed).ok, false);
  assert.equal(checkEventChange(id, bad, bad).ok, false);
  assert.equal(checkEventChange(id, "", "").ok, true);
});

test("ordinary migration events preserve all 216 legacy field combinations", () => {
  for (const abandoned of [false, true])
  for (const aliasValue of [undefined, "example"])
  for (const language of [undefined, "zh-CN"])
  for (const approvedRevision of [undefined, revisions.idealRevision, "f".repeat(40)])
  for (const implementationAcceptedRevision of [undefined, revisions.implementationRevision, "f".repeat(40)])
  for (const deploymentAcceptedRevision of [undefined, revisions.deploymentRevision, "f".repeat(40)]) {
    const status = { version: 1, id };
    for (const [key, value] of Object.entries({
      alias: aliasValue, language, approvedRevision,
      implementationAcceptedRevision, deploymentAcceptedRevision,
    })) if (value !== undefined) status[key] = value;
    if (abandoned) status.abandoned = true;
    const events = eventsFromStatus(status);
    const result = replayIdeaEvents(id, parseIdeaEvents(serializeIdeaEvents(events)));
    assert.equal(result.ok, true);
    assert.deepEqual({ version: 1, ...result.state.status }, status);
    assert.equal(
      deriveIdeaState(revisions, { version: 1, ...result.state.status }),
      deriveIdeaState(revisions, status),
    );
  }
});
