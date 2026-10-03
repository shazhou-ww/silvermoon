import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CommandRun,
  DOMAIN_MESSAGE_SCHEMA_VERSION,
  DomainInvariantError,
  driveCommand,
  initialInternalObservation,
  projectActions,
  projectReport,
  reduceObservation,
} from "../../src/command/index.js";

const INTENTION = {
  command: "whats-next",
  args: { idea: null, language: null },
};

function navigationObservation() {
  return {
    state: "navigation-ready",
    root: "C:\\repository",
    version: { type: "worktree" },
    configuration: {
      primaryRepository: "https://example.test/owner/repository.git",
      primaryBranch: "main",
      preferredLanguage: "en-US",
    },
    outputLanguage: "en-US",
    ideas: {
      counts: {
        preparing: 1,
        implementing: 0,
        deploying: 0,
        completed: 0,
        abandoned: 0,
      },
      activeIdeas: [{
        id: "01M36QGPNTXEPP61DA4KP4AVZF",
        state: "preparing",
      }],
    },
    problems: [],
  };
}

test("replays one ordered stream into deterministic report projections", () => {
  const run = new CommandRun(INTENTION, { eventSink: () => {} });
  const actionId = run.requestAction({
    type: "fetch-primary",
    repository: "https://example.test/owner/repository.git",
    branch: "main",
  });
  run.finishAction(actionId, "fetch-primary", {
    status: "success",
    result: { commit: "a".repeat(40) },
  });
  const report = run.complete(navigationObservation(), {
    nextSteps: "Choose an idea.",
  });
  const events = run.events;

  assert.deepEqual(
    events.map(({ sequence }) => sequence),
    events.map((_, index) => index + 1),
  );
  assert.ok(
    events.every(
      ({ schemaVersion }) => schemaVersion === DOMAIN_MESSAGE_SCHEMA_VERSION,
    ),
  );
  assert.equal(events[0].type, "intention.accepted");
  assert.equal(events.at(-1).type, "response.created");
  assert.deepEqual(Object.keys(report), [
    "intention",
    "observation",
    "actions",
    "response",
  ]);
  assert.deepEqual(report.actions, [{
    id: "action-1",
    type: "fetch-primary",
    status: "success",
    result: { commit: "a".repeat(40) },
  }]);
  const replayed = projectReport(structuredClone(events));
  assert.equal(JSON.stringify(replayed), JSON.stringify(report));
  assert.deepEqual(replayed, report);
  assert.throws(
    () => projectReport(events.slice(0, -1)),
    /response\.created/,
  );
  const tampered = structuredClone(events);
  tampered.at(-1).metadata.hash = "0".repeat(64);
  assert.throws(
    () => projectReport(tampered),
    /metadata does not match/,
  );
});

test("rejects gaps, duplicate completion, missing completion, and changed action types", () => {
  assert.throws(
    () => reduceObservation(initialInternalObservation(), {
      schemaVersion: DOMAIN_MESSAGE_SCHEMA_VERSION,
      sequence: 2,
      type: "intention.accepted",
      intention: INTENTION,
    }),
    DomainInvariantError,
  );

  const requested = {
    schemaVersion: DOMAIN_MESSAGE_SCHEMA_VERSION,
    sequence: 2,
    type: "action.requested",
    actionId: "action-1",
    action: { type: "fetch-primary" },
  };
  const accepted = {
    schemaVersion: DOMAIN_MESSAGE_SCHEMA_VERSION,
    sequence: 1,
    type: "intention.accepted",
    intention: INTENTION,
  };
  assert.throws(
    () => projectActions([accepted, requested]),
    /pending action/,
  );
  assert.throws(
    () => projectActions([accepted, {
      schemaVersion: DOMAIN_MESSAGE_SCHEMA_VERSION,
      sequence: 2,
      type: "action.finished",
      actionId: "action-1",
      actionType: "fetch-primary",
      status: "success",
      result: {},
    }]),
    /without being requested/,
  );
  assert.throws(
    () => projectActions([
      accepted,
      requested,
      {
        schemaVersion: DOMAIN_MESSAGE_SCHEMA_VERSION,
        sequence: 3,
        type: "action.finished",
        actionId: "action-1",
        actionType: "create-idea-scaffold",
        status: "success",
        result: {},
      },
    ]),
    /changed type/,
  );
  const finished = {
    schemaVersion: DOMAIN_MESSAGE_SCHEMA_VERSION,
    sequence: 3,
    type: "action.finished",
    actionId: "action-1",
    actionType: "fetch-primary",
    status: "success",
    result: {},
    facts: [],
  };
  assert.throws(
    () => projectActions([
      accepted,
      requested,
      finished,
      { ...finished, sequence: 4 },
    ]),
    /finished more than once/,
  );
  assert.throws(
    () => reduceObservation(
      reduceObservation(initialInternalObservation(), accepted),
      {
        schemaVersion: DOMAIN_MESSAGE_SCHEMA_VERSION,
        sequence: 2,
        type: "response.created",
        kind: "choice-required",
        metadata: {},
      },
    ),
    /before a terminal observation/,
  );
});

test("projects generated action sequences without losing order or pairing", () => {
  for (let actionCount = 1; actionCount <= 20; actionCount += 1) {
    const run = new CommandRun(INTENTION, { eventSink: () => {} });
    for (let index = 1; index <= actionCount; index += 1) {
      const type = index % 2 === 0 ? "inspect-remote" : "fetch-primary";
      const actionId = run.requestAction({ type });
      run.finishAction(actionId, type, index % 3 === 0
        ? {
          status: "failure",
          problem: { type: "simulated-failure", index },
        }
        : {
          status: "success",
          result: { index },
        });
    }
    const report = run.complete(navigationObservation(), {
      nextSteps: "Choose an idea.",
    });
    assert.equal(report.actions.length, actionCount);
    assert.deepEqual(
      report.actions.map(({ id }) => id),
      Array.from(
        { length: actionCount },
        (_, index) => `action-${index + 1}`,
      ),
    );
    assert.deepEqual(projectReport(run.events), report);
  }
});

test("response is unchanged when incidental action history changes", () => {
  const withoutAction = new CommandRun(INTENTION, { eventSink: () => {} });
  const first = withoutAction.complete(navigationObservation(), {
    nextSteps: "Choose an idea.",
  });

  const withAction = new CommandRun(INTENTION, { eventSink: () => {} });
  const actionId = withAction.requestAction({ type: "fetch-primary" });
  withAction.finishAction(actionId, "fetch-primary", {
    status: "success",
    result: { commit: "b".repeat(40) },
  });
  const second = withAction.complete(navigationObservation(), {
    nextSteps: "Choose an idea.",
  });

  assert.deepEqual(first.response, second.response);
  assert.notDeepEqual(first.actions, second.actions);
});

test("action result facts update observation through the reducer", () => {
  const run = new CommandRun(INTENTION, { eventSink: () => {} });
  const actionId = run.requestAction({ type: "fetch-primary" });
  const blocked = {
    ...navigationObservation(),
    state: "repository-sync-required",
    problems: [{
      type: "primary-fetch-failed",
      summary: "Network unavailable.",
    }],
  };
  run.finishAction(actionId, "fetch-primary", {
    status: "failure",
    problem: blocked.problems[0],
    facts: [{
      type: "repository.fetch-failed",
      observation: blocked,
      progress: "blocked",
      responseContext: { nextSteps: "Retry after restoring network access." },
    }],
  });

  assert.equal(run.observation.progress, "blocked");
  assert.equal(run.observation.observation.state, "repository-sync-required");
  const report = run.finish();
  assert.equal(report.response.kind, "blocked");
  assert.throws(
    () => run.complete(blocked),
    /terminal state/,
  );
});

test("functional driver executes injected probes and actions exactly once", async () => {
  let probes = 0;
  let actions = 0;
  const observedProject = {
    ...navigationObservation(),
    state: "task-pending",
  };
  const report = await driveCommand({
    intention: INTENTION,
    decide: (_intention, observation) => {
      if (observation.progress === "accepted") {
        return { type: "probe", effect: { type: "observe-project" } };
      }
      if (Object.keys(observation.actions).length === 0) {
        return { type: "action", effect: { type: "fetch-primary" } };
      }
      return {
        type: "response",
        observation: navigationObservation(),
        responseContext: { nextSteps: "Choose an idea." },
      };
    },
    ports: {
      probe: async () => {
        probes += 1;
        return {
          factType: "project.snapshot",
          observation: observedProject,
          progress: "observing",
        };
      },
      action: async () => {
        actions += 1;
        return {
          result: { commit: "a".repeat(40) },
          facts: [{
            type: "repository.primary-observed",
            observation: observedProject,
            progress: "observing",
            responseContext: {},
          }],
        };
      },
    },
  });

  assert.equal(probes, 1);
  assert.equal(actions, 1);
  assert.equal(report.response.kind, "choice-required");
  assert.deepEqual(report.actions, [{
    id: "action-1",
    type: "fetch-primary",
    status: "success",
    result: { commit: "a".repeat(40) },
  }]);
});
