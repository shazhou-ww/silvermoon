import assert from "node:assert/strict";
import { test } from "node:test";

import { lifecycleInstruction } from "../../src/foundation/report/instructions.ts";
import { whatsNextTemplates } from "../../src/foundation/report/templates/whats-next/index.ts";

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

test("event command templates expose required parameters in CLI order", () => {
  for (const language of ["en-US", "zh-CN"]) {
    const templates = whatsNextTemplates(language);
    assert.equal(
      templates["event-replay-command"]({
        audience: "agent",
        ideaId: "01IDEA",
      }),
      "silvermoon event replay 01IDEA --audience agent",
    );
    assert.equal(
      templates["event-append-command"]({
        audience: "agent",
        confirmDecision: false,
        expectedDigest: "<oid>",
        expectedLength: "<bytes>",
        expectedPrimary: "<commit>",
        ideaId: "01IDEA",
        inputPath: "request.json",
      }),
      "silvermoon event append 01IDEA --input request.json --expected-length <bytes> --expected-digest <oid> --expected-primary <commit> --audience agent",
    );
    assert.equal(
      templates["event-append-command"]({
        audience: "agent",
        confirmDecision: true,
        expectedDigest: "<oid>",
        expectedLength: "<bytes>",
        expectedPrimary: "<commit>",
        ideaId: "01IDEA",
        inputPath: "request.json",
      }),
      "silvermoon event append 01IDEA --input request.json --expected-length <bytes> --expected-digest <oid> --expected-primary <commit> --confirm-decision --audience agent",
    );
    assert.equal(
      templates["event-append-command"]({
        audience: "agent",
        confirmDecision: false,
        expectedDigest: "<oid>",
        expectedLength: "<bytes>",
        expectedPrimary: null,
        ideaId: "01IDEA",
        inputPath: "request.json",
      }),
      "silvermoon event append 01IDEA --input request.json --expected-length <bytes> --expected-digest <oid> --audience agent",
    );
  }
});

const REVISION = "1234567890abcdef1234567890abcdef12345678";
const IDEA_ID = "01ARZ3NDEKTSV4RRFFQ69G5FAV";

const phaseCases = [
  {
    acceptAction: "acceptIdeal",
    current: "ideal",
    evidence: "Idea candidate",
    revisionField: "idealRevision",
    revisionKind: "Idea",
    state: "preparing",
    submitAction: "submitIdeal",
  },
  {
    acceptAction: "acceptInner",
    current: "inner",
    evidence: "implementation evidence",
    revisionField: "implementationRevision",
    revisionKind: "implementation",
    state: "implementing",
    submitAction: "submitInner",
  },
  {
    acceptAction: "acceptOuter",
    current: "outer",
    evidence: "external evidence",
    revisionField: "deploymentRevision",
    revisionKind: "deployment",
    state: "deploying",
    submitAction: "submitOuter",
  },
] as const;

function eventIdea(
  phase: typeof phaseCases[number],
  submissionState: "unsubmitted" | "submitted",
  owner: "upstream" | "downstream",
) {
  const submission = {
    decision: phase.acceptAction,
    phase: phase.current,
    revision: { field: phase.revisionField, value: REVISION },
    state: submissionState,
    submit: phase.submitAction,
    ...(submissionState === "submitted" ? { submittedRevision: REVISION } : {}),
  };
  return {
    control: { lastTransfer: null, owner },
    deploymentRevision: REVISION,
    id: IDEA_ID,
    idealRevision: REVISION,
    implementationRevision: REVISION,
    ledgerPath: "ideas/example/ledger.md",
    relativePath: "ideas/example",
    state: phase.state,
    statusPath: "ideas/example/events.jsonl",
    submissions: {
      current: phase.current,
      ideal: phase.current === "ideal"
        ? submission
        : {
          decision: "acceptIdeal" as const,
          phase: "ideal" as const,
          revision: { field: "idealRevision" as const, value: REVISION },
          state: "accepted" as const,
          submit: "submitIdeal" as const,
        },
      inner: phase.current === "inner"
        ? submission
        : {
          decision: "acceptInner" as const,
          phase: "inner" as const,
          revision: {
            field: "implementationRevision" as const,
            value: REVISION,
          },
          state: phase.current === "outer" ? "accepted" as const : "unsubmitted" as const,
          submit: "submitInner" as const,
        },
      outer: phase.current === "outer"
        ? submission
        : {
          decision: "acceptOuter" as const,
          phase: "outer" as const,
          revision: {
            field: "deploymentRevision" as const,
            value: REVISION,
          },
          state: "unsubmitted" as const,
          submit: "submitOuter" as const,
        },
    },
    worlds: {
      deploymentRevision: {
        documentPath: "ideas/example/Deployment.md",
        path: "ideas/example/deployment",
      },
      idealRevision: {
        documentPath: "ideas/example/Idea.md",
        path: "ideas/example/ideal",
      },
      implementationRevision: {
        documentPath: "ideas/example/Implementation.md",
        path: "ideas/example/implementation",
      },
    },
  };
}

test("routing composes all three submit and accept guidance pairs without parameter drift", () => {
  const replay =
    `silvermoon event replay ${IDEA_ID} --audience agent`;
  const append =
    `silvermoon event append ${IDEA_ID} --input request.json --expected-length <bytes> --expected-digest <oid> --expected-primary <commit> --audience agent`;
  const decisionAppend =
    `silvermoon event append ${IDEA_ID} --input request.json --expected-length <bytes> --expected-digest <oid> --expected-primary <commit> --confirm-decision --audience agent`;

  for (const phase of phaseCases) {
    const submit = lifecycleInstruction(
      eventIdea(phase, "unsubmitted", "downstream"),
      "en-US",
      "en-US",
    );
    assert.match(
      submit,
      new RegExp(
        `When ${phase.evidence} is ready, synchronize it to primary, then use ${
          replay.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&")
        } and ${append.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&")} to record ${phase.submitAction}`,
      ),
    );
    assert.match(submit, new RegExp(`Do not request ${phase.acceptAction}`));

    const accept = lifecycleInstruction(
      eventIdea(phase, "submitted", "upstream"),
      "en-US",
      "en-US",
    );
    assert.match(
      accept,
      new RegExp(
        `request the explicit ${phase.acceptAction} decision for revision reference 1234567890ab\\.[\\s\\S]*obtain the exact cursor with ${
          replay.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&")
        }, then use ${
          decisionAppend.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&")
        }`,
      ),
    );

    const localizedSubmit = lifecycleInstruction(
      eventIdea(phase, "unsubmitted", "downstream"),
      "zh-CN",
      "zh-CN",
    );
    assert.ok(localizedSubmit.indexOf(replay) < localizedSubmit.indexOf(append));
    assert.match(localizedSubmit, new RegExp(
      `记录 ${phase.submitAction}；[\\s\\S]*不要请求 ${phase.acceptAction}`,
    ));

    const localizedAccept = lifecycleInstruction(
      eventIdea(phase, "submitted", "upstream"),
      "zh-CN",
      "zh-CN",
    );
    assert.ok(localizedAccept.indexOf(phase.acceptAction) < localizedAccept.indexOf(replay));
    assert.ok(localizedAccept.indexOf(replay) < localizedAccept.indexOf(decisionAppend));
    assert.match(
      localizedAccept,
      new RegExp(`${phase.revisionField} 记录 ${phase.acceptAction}`),
    );
  }
});

test("routing composes ping/pong append without primary or decision parameters", () => {
  const instruction = lifecycleInstruction(
    eventIdea(phaseCases[1], "submitted", "downstream"),
    "en-US",
    "en-US",
  );
  const interactionAppend =
    `silvermoon event append ${IDEA_ID} --input request.json --expected-length <bytes> --expected-digest <oid> --audience agent`;

  assert.match(instruction, new RegExp(
    `${interactionAppend.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&")} for that ping/pong exchange`,
  ));
  assert.doesNotMatch(instruction, /--expected-primary|--confirm-decision/);
});

test("routing composes inactive resume guidance outside lifecycle text", () => {
  const active = eventIdea(phaseCases[0], "submitted", "upstream");
  const inactive = {
    ...active,
    state: "abandoned",
    submissions: { ...active.submissions, current: null },
  };
  const replay =
    `silvermoon event replay ${IDEA_ID} --audience agent`;
  const resumeAppend =
    `silvermoon event append ${IDEA_ID} --input request.json --expected-length <bytes> --expected-digest <oid> --expected-primary <commit> --confirm-decision --audience agent`;

  for (const language of ["en-US", "zh-CN"]) {
    const instruction = lifecycleInstruction(inactive, language, language);
    assert.ok(instruction.indexOf(replay) < instruction.indexOf(resumeAppend));
    assert.match(instruction, /resume/);
  }
});
