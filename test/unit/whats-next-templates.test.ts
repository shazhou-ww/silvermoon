import assert from "node:assert/strict";
import { test } from "node:test";

import { lifecycleInstruction } from "../../src/foundation/report/instructions.ts";
import { whatsNextTemplates } from "../../src/foundation/report/templates/whats-next/index.ts";
import type {
  IdeaSubmissionsProjection,
  PhaseSubmissionProjection,
} from "../../src/foundation/report/types.ts";

const REVISIONS = {
  ideal: "a".repeat(40),
  implementation: "b".repeat(40),
  deployment: "c".repeat(40),
};

function submission(
  phase: PhaseSubmissionProjection["phase"],
  state: PhaseSubmissionProjection["state"],
): PhaseSubmissionProjection {
  const definitions = {
    ideal: {
      submit: "submitIdeal",
      decision: "acceptIdeal",
      field: "idealRevision",
      value: REVISIONS.ideal,
    },
    inner: {
      submit: "submitInner",
      decision: "acceptInner",
      field: "implementationRevision",
      value: REVISIONS.implementation,
    },
    outer: {
      submit: "submitOuter",
      decision: "acceptOuter",
      field: "deploymentRevision",
      value: REVISIONS.deployment,
    },
  } as const;
  const definition = definitions[phase];
  return {
    phase,
    submit: definition.submit,
    decision: definition.decision,
    state,
    revision: {
      field: definition.field,
      value: definition.value,
    },
    ...(state === "submitted"
      ? { submittedRevision: definition.value }
      : {}),
  };
}

function lifecycleIdea(
  state: "preparing" | "implementing" | "deploying",
  submissionState: PhaseSubmissionProjection["state"],
  owner: "upstream" | "downstream" = "upstream",
): Parameters<typeof lifecycleInstruction>[0] {
  const current = {
    preparing: "ideal",
    implementing: "inner",
    deploying: "outer",
  }[state] as IdeaSubmissionsProjection["current"];
  return {
    id: "01M4TESTIDEA00000000000000",
    alias: "fixture",
    state,
    control: {
      owner,
      lastTransfer: null,
    },
    submissions: {
      current,
      ideal: submission("ideal", current === "ideal" ? submissionState : "accepted"),
      inner: submission("inner", current === "inner" ? submissionState : "accepted"),
      outer: submission("outer", current === "outer" ? submissionState : "accepted"),
    },
    idealRevision: REVISIONS.ideal,
    implementationRevision: REVISIONS.implementation,
    deploymentRevision: REVISIONS.deployment,
    worlds: {
      idealRevision: { documentPath: "Ideal.md", path: "ideal" },
      implementationRevision: {
        documentPath: "Implementation.md",
        path: "inner",
      },
      deploymentRevision: {
        documentPath: "Deployment.md",
        path: "outer",
      },
    },
    ledgerPath: "ledger.md",
    relativePath: ".silvermoon/ideas/fixture",
  };
}

test("what's next templates select a catalog by language", () => {
  assert.equal(
    whatsNextTemplates("en-US")["idea-not-found"]({ selector: "missing" }),
    "Idea missing does not match an observed ULID or unique alias.",
  );
  assert.equal(
    whatsNextTemplates("zh-CN")["idea-not-found"]({ selector: "missing" }),
    "Idea missing 未匹配任何已观察到的 ULID 或唯一 alias。",
  );
  assert.equal(
    whatsNextTemplates("zh-Hans")["navigation-ready"]({
      hasActiveIdea: false,
    }),
    [
      "请明确选择继续一个 active idea，或创建一个新 idea。",
      "当前没有 active idea。",
      "如需继续，运行 `silvermoon whats-next <ULID-or-alias>`；如需开始其他工作，先讨论目标，再运行 `silvermoon create-idea`。",
    ].join("\n"),
  );
});

test("what's next templates render dynamic repository values", () => {
  const templates = whatsNextTemplates("en-US");
  assert.deepEqual(
    templates["primary-behind"]({
      branch: "topic",
      head: "abc123",
      mergeCommand: "`git merge --ff-only def456`",
      primary: "def456",
      primaryBranch: "main",
      recheckCommand: "`silvermoon whats-next`",
      remote: "origin",
    }),
    {
      summary:
        "Local HEAD is abc123; observed primary is def456; relationship is behind.",
      instructions:
        "Fast-forward branch topic to observed primary def456 with `git merge --ff-only def456` without rewriting history, then run `silvermoon whats-next` again.",
    },
  );
});

test("lifecycle instructions route all six derived template phases", () => {
  const cases = [
    {
      state: "preparing",
      submissionState: "unsubmitted",
      expected: "Continue fixture in Ideal.md and ledger.md.",
      excluded: "The current Idea revision was recorded by submitIdeal",
    },
    {
      state: "preparing",
      submissionState: "submitted",
      expected: "The current Idea revision was recorded by submitIdeal",
      excluded: "Continue fixture in Ideal.md and ledger.md.",
    },
    {
      state: "implementing",
      submissionState: "unsubmitted",
      expected: "Continue fixture in Implementation.md",
      excluded: "The current implementation revision was recorded by submitInner",
    },
    {
      state: "implementing",
      submissionState: "submitted",
      expected: "The current implementation revision was recorded by submitInner",
      excluded: "Continue fixture in Implementation.md",
    },
    {
      state: "deploying",
      submissionState: "unsubmitted",
      expected: "Continue fixture in Deployment.md",
      excluded: "The current deployment revision was recorded by submitOuter",
    },
    {
      state: "deploying",
      submissionState: "submitted",
      expected: "The current deployment revision was recorded by submitOuter",
      excluded: "Continue fixture in Deployment.md",
    },
  ] as const;

  for (const { state, submissionState, expected, excluded } of cases) {
    const instruction = lifecycleInstruction(
      lifecycleIdea(state, submissionState),
      "en-US",
      "en-US",
    );
    assert.match(instruction, new RegExp(expected));
    assert.doesNotMatch(instruction, new RegExp(excluded));
  }
});

test("submitted lifecycle templates preserve downstream phase-local exchange", () => {
  const cases = [
    ["preparing", "Idea", "acceptIdeal"],
    ["implementing", "implementation", "acceptInner"],
    ["deploying", "deployment", "acceptOuter"],
  ] as const;

  for (const [state, label, action] of cases) {
    const instruction = lifecycleInstruction(
      lifecycleIdea(state, "submitted", "downstream"),
      "en-US",
      "en-US",
    );
    assert.match(
      instruction,
      new RegExp(`The current ${label} revision remains recorded`),
    );
    assert.match(instruction, /use ping\/pong for that exchange/);
    assert.match(instruction, new RegExp(`do not request ${action}`));
    assert.doesNotMatch(instruction, /Present response\.review/);
  }
});
