import assert from "node:assert/strict";
import { test } from "node:test";

import { CommandRun, createCommandRun } from "../../src/foundation/command-message/index.ts";
import { deepFreeze } from "../../src/foundation/command-message/index.ts";
import { assertHumanGate, planProjectedAppend } from "../../src/foundation/event-reducer/index.ts";
import { gitContentDigest } from "../../src/foundation/event-history/index.ts";
import { replayIdeaEvents, serializeIdeaEvents } from "../../src/foundation/event-codec/index.ts";
import { ideaPaths } from "../../src/foundation/coordinates/index.ts";
import { renderMarkdownResponse } from "../../src/foundation/renderer/index.ts";
import { evaluateLocalReadiness } from "../../src/business/shared/evaluate-local-readiness.ts";
import { assessRepositoryReadinessWith } from "../../src/business/shared/assess-repository-readiness-with.ts";
import { listIdeasUseCase } from "../../src/business/list-ideas.ts";
import { buildIdeaScaffold } from "../../src/foundation/scaffold-plan/index.ts";
import { encodeUlid } from "../../src/foundation/idea-model/index.ts";
import { normalizeIdeaQuery, normalizeIdeaQueryCore, queryIdeaInventoryCore } from "../../src/foundation/idea-query/index.ts";
import { IDEA_STATES } from "../../src/foundation/idea-model/index.ts";
import type {
  ProjectConfig,
  ReadyObservation,
  RepositoryState,
  SnapshotObservation,
} from "../../src/business/shared/business-types.ts";
import type {
  ActionRequest,
  DomainMessage,
} from "../../src/foundation/command-message/observation.ts";
import type { IdeaEvent } from "../../src/foundation/event-codec/index.ts";
import type { ReportResponse } from "../../src/foundation/report/types.ts";

const id = "01M3ZQFBW4026AGVR9NDFG8SE5";
const intention = { command: "whats-next", args: { idea: id, language: null } };
const config = {
  version: 2, primaryRepository: "https://example.test/owner/repository.git", primaryBranch: "main",
} satisfies ProjectConfig;
const observed: ReadyObservation = {
  config,
  contentLanguage: "en-US",
  findings: [],
  layout: { diagnostics: [], ideas: [] },
  outputLanguage: "en-US",
  projectReady: true,
  observation: {
    state: "project-ready",
    root: "/fixture",
    outputLanguage: "en-US",
    problems: [],
    configuration: config,
    version: { type: "worktree" },
  },
};
const repository = {
  head: "a".repeat(40),
  branch: { branch: "topic", repository: config.primaryRepository, upstreamBranch: "main", remote: "origin" },
  changes: { conflicted: [], staged: [], unstaged: [], untracked: [] },
} satisfies RepositoryState;

test("local creation readiness accepts arbitrary tracked branches without mutating facts", () => {
  const input = deepFreeze({ repository, observed, root: "/fixture", recheckCommand: "silvermoon create-idea" });
  assert.equal(evaluateLocalReadiness(input).ready, true);
  const invalid = { ...input, repository: { ...repository, branch: { ...repository.branch, upstreamBranch: "other" } } };
  const problem = evaluateLocalReadiness(invalid).observation.problems[0];
  assert.ok(problem);
  assert.equal(problem.type, "primary-upstream-mismatch");
});

test("readiness checks local facts before fetch, and creation never fetches", async () => {
  const calls: string[] = [];
  const runtime = createCommandRun(intention, { eventSink: () => {} });
  const ports: NonNullable<Parameters<typeof assessRepositoryReadinessWith>[1]> = {
    inspectRepositoryState: () => { calls.push("local"); return repository; },
    fetchPrimary: () => { calls.push("fetch"); return repository.head; },
    compareCommits: (): "aligned" => { calls.push("compare"); return "aligned"; },
    inspectEventHistory: async () => {
      calls.push("history");
      return {
        baseline: {
          commit: repository.head,
          source: "fetched-primary",
          ref: null,
        },
        parent: null,
        results: [],
        target: repository.head,
        valid: true,
      };
    },
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
  const calls: string[] = [];
  const unavailable: SnapshotObservation = {
    config: null,
    contentLanguage: "en-US",
    findings: [{ instruction: "Repair project configuration." }],
    layout: null,
    observation: {
      state: "project-setup-required",
      root: "/fixture",
      outputLanguage: "en-US",
      problems: [],
      observedThrough: "configuration",
    },
    outputLanguage: "en-US",
    projectReady: false,
  };
  const report = await listIdeasUseCase({ root: "/fixture" }, {
    createCommandRun: (intent) => createCommandRun(intent, { eventSink: () => {} }),
    observeSnapshot: async () => {
      calls.push("observe");
      return unavailable;
    },
  });
  assert.deepEqual(calls, ["observe"]);
  assert.equal(report.response.kind, "blocked");
  assert.equal(report.response.kind, "blocked");
  const nextStep = report.response.nextSteps[0];
  assert.ok(nextStep);
  assert.equal(nextStep.text, "Repair project configuration.");
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
  const report = run.complete({
    ...observed.observation,
    state: "navigation-ready",
    ideas: { counts: {}, activeIdeas: [] },
  });
  assert.deepEqual(run.events.filter(
    (event): event is Extract<DomainMessage, { actionId: string }> =>
      event.type.startsWith("action.") && "actionId" in event,
  )
    .map(({ type, actionId }) => [type, actionId]), [
    ["action.requested", "action-1"], ["action.requested", "action-2"],
    ["action.finished", "action-2"], ["action.finished", "action-1"],
  ]);
  assert.equal(report.actions.length, 2);
  assert.equal(other.events.length, 1);
});

test("CommandRun compatibility preserves subclass dispatch and writable eventSink", async () => {
  const calls: unknown[] = [];
  class CompatibleRun extends CommandRun {
    override requestAction(action: ActionRequest) {
      calls.push(action.type);
      return super.requestAction(action);
    }
  }
  const initialSink = function (this: CommandRun, event: DomainMessage) {
    if (event.type === "intention.accepted") {
      const accepted = this.observation.intention;
      assert.ok(accepted);
      assert.equal(accepted.command, "whats-next");
    }
  };
  const run = new CompatibleRun(intention, {
    eventSink: initialSink,
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
  const response: ReportResponse = {
    kind: "idea-list", language: "en-US", summary: "One idea.",
    inventory: { counts: { preparing: 1 }, matched: 1, returned: 1 }, query: {},
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
  const event: IdeaEvent = {
    sequence: 1,
    type: "acceptIdeal",
    payload: { idealRevision: revision },
  };
  const idea = {
    state: "preparing",
    status: { submittedIdealRevision: revision },
    revisions: {
      idealRevision: revision,
      implementationRevision: "",
      deploymentRevision: "",
    },
  };
  assert.throws(() => assertHumanGate(event, idea, { idealRevision: revision }, false), /explicit human decision/);
  assert.throws(() => assertHumanGate(event, idea, { idealRevision: "c".repeat(40) }, true), /exact world revision/);
  assert.throws(() => assertHumanGate(
    event,
    { ...idea, status: {} },
    { idealRevision: revision },
    true,
  ), /submit the same exact world revision/);
  assert.doesNotThrow(() => assertHumanGate(event, idea, { idealRevision: revision }, true));
});

test("pure append planning replaces one complete event file", () => {
  const paths = ideaPaths(id);
  for (const objectIdLength of [40, 64]) {
    for (const count of [999, 1000]) {
      const options = { objectIdLength };
      const events = Array.from({ length: count }, (_, index) => ({
        sequence: index + 1, type: "ping", payload: { message: "message" },
      }));
      const bytes = Buffer.from(serializeIdeaEvents(events, options));
      const replayed = replayIdeaEvents(id, events, options);
      assert.ok(replayed.ok);
      const before = {
        state: replayed.state,
        bytes,
      };
      const planned = planProjectedAppend(before, paths,
        { sequence: count + 1, type: "pong", payload: { message: "reply" } },
        options);
      assert.equal(planned.reduction.ok, true);
      assert.ok(planned.reduction.ok);
      assert.ok("files" in planned);
      const file = planned.files[0];
      assert.ok(file);
      assert.equal(file.path, paths.eventsPath);
      assert.equal(file.before, bytes);
      assert.deepEqual(file.after, Buffer.concat([bytes, planned.record]));
      assert.equal(planned.digest, gitContentDigest("blob", file.after, options));
      assert.equal(before.state.sequence, count);
      assert.deepEqual(before.bytes, bytes);
    }
  }
});

test("scaffold planning keeps v1 status and v2 event files distinct", () => {
  for (const formatVersion of [1, 2]) {
    const plan = buildIdeaScaffold({ id, formatVersion, contentLanguage: "zh-CN" });
    assert.equal(plan.files.length, 5);
    assert.equal(plan.directoryPaths.length, 4);
    const finalFile = plan.files.at(-1);
    assert.ok(finalFile);
    assert.equal(finalFile[0], formatVersion === 2 ? ideaPaths(id).eventsPath : ideaPaths(id).statusPath);
  }
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
    Reflect.apply(Array.prototype.push, IDEA_STATES, ["future-test-state"]);
    assert.deepEqual(normalizeIdeaQuery({ all: true }).states, [...original, "future-test-state"]);
    assert.throws(() => normalizeIdeaQuery({ states: ["future-test-state"] }), /state must be/);
  } finally {
    IDEA_STATES.splice(0, IDEA_STATES.length, ...original);
  }
});
