import assert from "node:assert/strict";
import { test } from "node:test";

import { CommandRun, createCommandRun } from "../../src/foundation/command-message/index.js";
import { deepFreeze } from "../../src/foundation/command-message/index.js";
import { assertHumanGate, planProjectedAppend } from "../../src/foundation/event-reducer/index.js";
import { eventFolderDigest, gitContentDigest, segmentName } from "../../src/foundation/event-history/index.js";
import { replayIdeaEvents, serializeIdeaEvents } from "../../src/foundation/event-codec/index.js";
import { ideaPaths } from "../../src/foundation/coordinates/index.js";
import { renderMarkdownResponse } from "../../src/foundation/renderer/index.js";
import { evaluateLocalReadiness } from "../../src/business/shared/evaluate-local-readiness.js";
import { assessRepositoryReadinessWith } from "../../src/business/shared/assess-repository-readiness-with.js";
import { listIdeasUseCase } from "../../src/business/list-ideas.js";
import { buildIdeaScaffold } from "../../src/foundation/scaffold-plan/index.js";
import { evaluateNpmAdoption, skillInstruction } from "../../src/foundation/skill-registration/index.js";
import { encodeUlid } from "../../src/foundation/idea-model/index.js";
import { normalizeIdeaQuery, normalizeIdeaQueryCore, queryIdeaInventoryCore } from "../../src/foundation/idea-query/index.js";
import { IDEA_STATES } from "../../src/foundation/idea-model/index.js";

const id = "01M3ZQFBW4026AGVR9NDFG8SE5";
const intention = { command: "whats-next", args: { idea: id, language: null } };
const config = {
  version: 2, primaryRepository: "https://example.test/owner/repository.git", primaryBranch: "main",
};
const observed = {
  config, outputLanguage: "en-US",
  observation: { state: "project-ready", root: "/fixture", outputLanguage: "en-US", problems: [] },
};
const repository = {
  head: "a".repeat(40),
  branch: { branch: "topic", repository: config.primaryRepository, upstreamBranch: "main", remote: "origin" },
  changes: { conflicted: [], staged: [], unstaged: [], untracked: [] },
};

test("local creation readiness accepts arbitrary tracked branches without mutating facts", () => {
  const input = deepFreeze({ repository, observed, root: "/fixture", recheckCommand: "silvermoon create-idea" });
  assert.equal(evaluateLocalReadiness(input).ready, true);
  const invalid = { ...input, repository: { ...repository, branch: { ...repository.branch, upstreamBranch: "other" } } };
  assert.equal(evaluateLocalReadiness(invalid).observation.problems[0].type, "primary-upstream-mismatch");
});

test("readiness checks local facts before fetch, and creation never fetches", async () => {
  const calls = [];
  const runtime = createCommandRun(intention, { eventSink: () => {} });
  const ports = {
    inspectRepositoryState: () => { calls.push("local"); return repository; },
    fetchPrimary: () => { calls.push("fetch"); return repository.head; },
    compareCommits: () => { calls.push("compare"); return "aligned"; },
    inspectEventHistory: async () => { calls.push("history"); },
  };
  const request = { root: "/fixture", observed, runtime };
  assert.equal((await assessRepositoryReadinessWith({ ...request, synchronizePrimary: false }, ports)).ready, true);
  assert.deepEqual(calls, ["local"]);
  calls.length = 0;
  assert.equal((await assessRepositoryReadinessWith(request, ports)).ready, true);
  assert.deepEqual(calls, ["local", "fetch", "compare", "history"]);
  calls.length = 0;
  const dirty = { ...repository, changes: { ...repository.changes, untracked: [{ path: "unknown" }] } };
  const blocked = await assessRepositoryReadinessWith(request, {
    ...ports, inspectRepositoryState: () => { calls.push("local"); return dirty; },
  });
  assert.equal(blocked.ready, false);
  assert.deepEqual(calls, ["local"]);
});

test("inventory use case reports project blockers through injected observation only", async () => {
  const calls = [];
  const report = await listIdeasUseCase({ root: "/fixture" }, {
    createCommandRun: (intent) => createCommandRun(intent, { eventSink: () => {} }),
    observeSnapshot: async () => {
      calls.push("observe");
      return {
        projectReady: false,
        observation: { ...observed.observation, state: "project-setup-required" },
        findings: [{ instruction: "Repair project configuration." }],
      };
    },
  });
  assert.deepEqual(calls, ["observe"]);
  assert.equal(report.response.kind, "blocked");
  assert.equal(report.response.nextSteps[0].text, "Repair project configuration.");
  assert.deepEqual(Object.keys(report), ["intention", "observation", "actions", "response"]);
  assert.deepEqual(report.actions, []);
});

test("closure runtime preserves nested action ordering and independent runs", async () => {
  const run = createCommandRun(intention, { eventSink: () => {} });
  const other = createCommandRun(intention, { eventSink: () => {} });
  await run.performAction({ type: "outer" }, async () => {
    await run.performAction({ type: "inner" }, async () => ({ value: 1 }));
    return { value: 2 };
  });
  const report = run.complete({ ...observed.observation, state: "navigation-ready", ideas: { activeIdeas: [] } });
  assert.deepEqual(run.events.filter(({ type }) => type.startsWith("action."))
    .map(({ type, actionId }) => [type, actionId]), [
    ["action.requested", "action-1"], ["action.requested", "action-2"],
    ["action.finished", "action-2"], ["action.finished", "action-1"],
  ]);
  assert.equal(report.actions.length, 2);
  assert.equal(other.events.length, 1);
});

test("CommandRun compatibility preserves subclass dispatch and writable eventSink", async () => {
  const calls = [];
  class CompatibleRun extends CommandRun {
    requestAction(action) {
      calls.push(action.type);
      return super.requestAction(action);
    }
  }
  const run = new CompatibleRun(intention, {
    eventSink(event) {
      if (event.type === "intention.accepted") {
        assert.equal(this.observation.intention.command, "whats-next");
      }
    },
  });
  assert.equal(Object.hasOwn(run, "eventSink"), true);
  run.eventSink = (event) => calls.push(event.type);
  await run.performAction({ type: "probe" }, async () => ({}));
  assert.deepEqual(calls, ["probe", "action.requested", "action.finished"]);
});

test("pure freezing clones input instead of freezing caller-owned objects", () => {
  const input = { nested: { value: 1 } };
  const frozen = deepFreeze(input);
  assert.equal(Object.isFrozen(input), false);
  assert.equal(Object.isFrozen(input.nested), false);
  assert.equal(Object.isFrozen(frozen.nested), true);
  input.nested.value = 2;
  assert.equal(frozen.nested.value, 1);
});

test("pure Markdown rendering uses explicit clock and local calendar facts", () => {
  const timestamp = "2020-01-01T23:59:00.000Z";
  const response = {
    kind: "idea-list", language: "en-US", summary: "One idea.",
    inventory: { counts: { preparing: 1 } }, query: {},
    items: [{ id, state: "preparing", createdAt: timestamp, title: "Title" }],
  };
  const now = new Date("2026-10-03T00:00:00.000Z");
  const dateFacts = new Map([[timestamp, {
    milliseconds: Date.parse(timestamp), localDate: "2020-01-02",
  }]]);
  assert.match(renderMarkdownResponse(response, { now, dateFacts }), /2020-01-02/);
  assert.throws(() => renderMarkdownResponse(response, { now, dateFacts: new Map() }), /invalid timestamp/);
});

test("event decisions require explicit authorization and the synchronized exact world", () => {
  const revision = "b".repeat(40);
  const event = { type: "acceptIdeal", payload: { idealRevision: revision } };
  const idea = { state: "preparing", revisions: { idealRevision: revision } };
  assert.throws(() => assertHumanGate(event, idea, { idealRevision: revision }, false), /explicit human decision/);
  assert.throws(() => assertHumanGate(event, idea, { idealRevision: "c".repeat(40) }, true), /exact world revision/);
  assert.doesNotThrow(() => assertHumanGate(event, idea, { idealRevision: revision }, true));
});

test("pure append planning preserves the 1000-record boundary without invoking hash observers", () => {
  const paths = ideaPaths(id);
  for (const objectIdLength of [40, 64]) {
    for (const count of [999, 1000]) {
      const options = { objectIdLength };
      const events = Array.from({ length: count }, (_, index) => ({
        sequence: index + 1, type: "ping", payload: { message: "message" },
      }));
      const bytes = Buffer.from(serializeIdeaEvents(events, options));
      const name = `${paths.eventsDirectory}/${segmentName(1)}`;
      const object = gitContentDigest("blob", bytes, options);
      const before = {
        state: replayIdeaEvents(id, events, options).state,
        entries: [{ name, object }],
        tail: { name, bytes },
      };
      const planned = planProjectedAppend(before, paths,
        { sequence: count + 1, type: "pong", payload: { message: "reply" } },
        { ...options, onHash: () => { throw new Error("Impure callback"); } });
      assert.equal(planned.reduction.ok, true);
      assert.equal(planned.files[0].path, `${paths.eventsDirectory}/${segmentName(count === 1000 ? 2 : 1)}`);
      assert.equal(planned.files[0].before, count === 1000 ? null : bytes);
      const segments = count === 1000
        ? [{ name: segmentName(1), object }, { name: segmentName(2), object: gitContentDigest("blob", planned.record, options) }]
        : [{ name: segmentName(1), object: gitContentDigest("blob", planned.files[0].after, options) }];
      assert.equal(planned.digest, eventFolderDigest(segments, options));
      assert.equal(before.state.sequence, count);
      assert.deepEqual(before.tail.bytes, bytes);
    }
  }
});

test("scaffold planning keeps v1 status and v2 segmented authorities distinct", () => {
  for (const formatVersion of [1, 2]) {
    const plan = buildIdeaScaffold({ id, formatVersion, contentLanguage: "zh-CN" });
    assert.equal(plan.files.length, 5);
    assert.equal(plan.directoryPaths.length, formatVersion === 2 ? 5 : 4);
    assert.equal(plan.files.at(-1)[0], formatVersion === 2 ? ideaPaths(id).eventsPath : ideaPaths(id).statusPath);
  }
});

test("adoption policy distinguishes bundled skills and the source runtime exemption", () => {
  const packageManager = { manager: "pnpm", workspace: false };
  assert.equal(skillInstruction("/bundled/skills", packageManager, "/bundled/skills"),
    'Run `npx skills add "/bundled/skills" --skill silvermoon --agent universal --yes --copy`.');
  assert.match(skillInstruction("./node_modules/silvermoon/skills", packageManager, "/bundled/skills"),
    /After you add the required Silvermoon devDependency/);
  const facts = {
    manifest: {}, packageManager, sourceCheckout: true, sameSourceRuntime: true,
    expectedDependency: "^0.3.0", version: "0.3.0",
  };
  assert.deepEqual(evaluateNpmAdoption(facts), []);
  assert.equal(evaluateNpmAdoption({ ...facts, sameSourceRuntime: false })[0].problem.type,
    "source-checkout-runtime-required");
});

test("ULID encoding depends only on explicit time and random bytes", () => {
  const input = { now: 0, random: Buffer.alloc(10) };
  assert.equal(encodeUlid(input), "0".repeat(26));
  assert.deepEqual(input.random, Buffer.alloc(10));
});

test("pure inventory rules consume explicit enumeration facts without modifying them", () => {
  const facts = {
    ideaStates: ["preparing"], activeStates: ["preparing"],
    queryStates: new Set(["active", "preparing"]),
  };
  const before = structuredClone(facts);
  assert.deepEqual(normalizeIdeaQueryCore({}, facts).states, ["preparing"]);
  const result = queryIdeaInventoryCore([
    { id, state: "preparing", createdAt: "2026-10-03T00:00:00.000Z" },
  ], {}, facts);
  assert.equal(result.summary.returned, 1);
  assert.deepEqual(result.summary.counts, { preparing: 1 });
  assert.deepEqual(facts, before);
});

test("public query wrappers preserve existing mutable enumeration exports", () => {
  const original = [...IDEA_STATES];
  try {
    IDEA_STATES.push("future-test-state");
    assert.deepEqual(normalizeIdeaQuery({ all: true }).states, [...original, "future-test-state"]);
    assert.throws(() => normalizeIdeaQuery({ states: ["future-test-state"] }), /state must be/);
  } finally {
    IDEA_STATES.splice(0, IDEA_STATES.length, ...original);
  }
});
