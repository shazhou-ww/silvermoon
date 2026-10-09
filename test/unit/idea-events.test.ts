import assert from "node:assert/strict";
import { test } from "node:test";

import {
  EVENT_PERMISSIONS, EVENT_RENAMES, IDEA_EVENT_TYPES,
  checkEventChange, eventsFromStatus, initialEventState, parseIdeaEvents,
  reduceIdeaEvent, replayIdeaEvents, serializeIdeaEvents, validateIdeaEvent,
} from "../../src/foundation/event-codec/index.ts";
import type {
  IdeaEvent,
  IdeaEventReduction,
  IdeaEventState,
  IdeaEventStatus,
} from "../../src/foundation/event-codec/index.ts";
import { deriveEventIdeaState } from "../../src/foundation/event-reducer/index.ts";
import { deriveIdeaState } from "../../src/foundation/idea-model/index.ts";

const id = "01M3SJTKFRQ19DP0RPPJACKGMC";
const revisions = {
  idealRevision: "1".repeat(40),
  implementationRevision: "2".repeat(40),
  deploymentRevision: "3".repeat(40),
};
const alias = (sequence: number, value: string|null): IdeaEvent => ({
  sequence, type: "setAlias", payload: { alias: value },
});

function successfulState(result: IdeaEventReduction): IdeaEventState {
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("Expected successful reduction");
  return result.state;
}

function failureCode(result: IdeaEventReduction): string {
  assert.equal(result.ok, false);
  if (result.ok) throw new Error("Expected failed reduction");
  return result.code;
}

test("internal legacy conversion retains status and final v2 retains ordered interaction", () => {
  const options = { legacy: true };
  const legacy: IdeaEvent[] = [
    { sequence: 1, type: "alias.updated", payload: { alias: "example" } },
    { sequence: 2, type: "ideal.approved", payload: { idealRevision: revisions.idealRevision } },
    { sequence: 3, type: "idea.abandoned" },
    { sequence: 4, type: "idea.resumed" },
  ];
  const migrated = legacy.map((event) => {
    const renamed = EVENT_RENAMES[event.type];
    assert.ok(renamed);
    return validateIdeaEvent({ ...event, type: renamed });
  });
  assert.equal(IDEA_EVENT_TYPES.length, 12);
  assert.equal(EVENT_PERMISSIONS.acceptIdeal, "upstream");
  assert.equal(EVENT_PERMISSIONS.submitIdeal, "downstream");
  assert.equal(EVENT_PERMISSIONS.ping, "upstream");
  assert.equal(EVENT_PERMISSIONS.pong, "downstream");
  assert.equal(EVENT_PERMISSIONS.setAlias, "both");
  assert.deepEqual(successfulState(replayIdeaEvents(id, migrated)).status,
    successfulState(replayIdeaEvents(id, legacy, options)).status);
  const messages: Array<{
    sequence: number;
    type: "ping" | "pong";
    payload: { message: string };
  }> = [
    { sequence: 5, type: "pong", payload: { message: "blocked" } },
    { sequence: 6, type: "ping", payload: { message: "new objective" } },
    { sequence: 7, type: "pong", payload: { message: "still blocked" } },
    { sequence: 8, type: "pong", payload: { message: "waiting" } },
  ];
  const events = [...migrated, ...messages];
  assert.deepEqual(parseIdeaEvents(serializeIdeaEvents(events)), events);
  assert.deepEqual(successfulState(replayIdeaEvents(id, events)).interaction, {
    messages: messages.map(({ sequence, type, payload }) => ({
      sequence, type, message: payload.message,
    })),
  });
  assert.deepEqual(successfulState(replayIdeaEvents(id, events)).control, {
    owner: "upstream",
    lastTransfer: { sequence: 8, type: "pong" },
  });
  assert.equal(successfulState(replayIdeaEvents(id, events)).status.approvedRevision,
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
  const abandoned = successfulState(
    replayIdeaEvents(id, [{ sequence: 1, type: "abandon" }], options),
  );
  for (const event of [
    { sequence: 2, type: "ping", payload: { message: "continue" } },
    { sequence: 2, type: "pong", payload: { message: "blocked" } },
    { sequence: 2, type: "submitIdeal", payload: { idealRevision: revisions.idealRevision } },
    { sequence: 2, type: "setAlias", payload: { alias: "new-alias" } },
    { sequence: 2, type: "acceptIdeal", payload: { idealRevision: revisions.idealRevision } },
    { sequence: 2, type: "abandon" },
  ]) assert.equal(failureCode(reduceIdeaEvent(abandoned, event, options)), "abandoned");
  assert.equal(reduceIdeaEvent(abandoned, { sequence: 2, type: "resume" }, options).ok, true);
});

test("serializes submit and accept pairs and replays without mutating inputs", () => {
  const events = [
    alias(1, "example"),
    { sequence: 2, type: "setLanguage", payload: { language: "zh-CN" } },
    { sequence: 3, type: "submitIdeal", payload: { idealRevision: revisions.idealRevision } },
    { sequence: 4, type: "acceptIdeal", payload: { idealRevision: revisions.idealRevision } },
    { sequence: 5, type: "submitInner", payload: { implementationRevision: revisions.implementationRevision } },
    { sequence: 6, type: "acceptInner", payload: { implementationRevision: revisions.implementationRevision } },
    { sequence: 7, type: "submitOuter", payload: { deploymentRevision: revisions.deploymentRevision } },
    { sequence: 8, type: "acceptOuter", payload: { deploymentRevision: revisions.deploymentRevision } },
    { sequence: 9, type: "abandon" },
    { sequence: 10, type: "resume" },
    alias(11, null),
    { sequence: 12, type: "setLanguage", payload: { language: null } },
  ];
  const saved = structuredClone(events);
  const source = serializeIdeaEvents(events);
  assert.deepEqual(parseIdeaEvents(Buffer.from(source)), events);
  const result = replayIdeaEvents(id, events);
  assert.equal(result.ok, true);
  const state = successfulState(result);
  assert.equal(deriveEventIdeaState(revisions, state.status), "completed");
  assert.equal(state.sequence, 12);
  assert.equal(state.status.alias, undefined);
  assert.equal(state.status.language, undefined);
  assert.equal(state.status.submittedIdealRevision, revisions.idealRevision);
  assert.equal(
    state.status.submittedImplementationRevision,
    revisions.implementationRevision,
  );
  assert.equal(
    state.status.submittedDeploymentRevision,
    revisions.deploymentRevision,
  );
  assert.deepEqual(state.control, {
    owner: "downstream",
    lastTransfer: { sequence: 10, type: "resume" },
  });
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
    '{"sequence":1,"type":"submitIdeal","payload":{"idealRevision":null}}\n',
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
  const state = successfulState(replayIdeaEvents(id, [alias(1, "a")]));
  const cases: Array<readonly [IdeaEvent, string]> = [
    [alias(2, "a"), "no-state-change"],
    [alias(3, "b"), "sequence-conflict"],
    [alias(1, "b"), "sequence-conflict"],
    [{ sequence: 2, type: "resume" }, "no-state-change"],
  ];
  for (const [event, code] of cases) {
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
    const statusFields: IdeaEventStatus = { id };
    for (const [key, value] of Object.entries({
      alias: aliasValue, language, approvedRevision,
      implementationAcceptedRevision, deploymentAcceptedRevision,
    })) if (value !== undefined) statusFields[key] = value;
    if (abandoned) statusFields.abandoned = true;
    const status = Object.assign(statusFields, { version: 1 as const });
    const events = eventsFromStatus(status);
    const result = replayIdeaEvents(id, parseIdeaEvents(serializeIdeaEvents(events)));
    assert.equal(result.ok, true);
    const state = successfulState(result);
    assert.deepEqual({ version: 1, ...state.status }, status);
    assert.equal(
      deriveIdeaState(revisions, { version: 1, ...state.status }),
      deriveIdeaState(revisions, status),
    );
  }
});
