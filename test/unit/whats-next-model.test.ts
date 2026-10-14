import assert from "node:assert/strict";
import { test } from "node:test";
import { whatsNextUseCase } from "../../src/business/whats-next.ts";
import { createSilvermoonObjectiveLoader, SILVERMOON_OBJECTIVE_URIS } from "../../src/business/objective-guides.ts";
import type { SilvermoonCheckId } from "../../src/business/objective-guides.ts";
import type { ObjectiveObservation } from "../../src/objective-guide/index.ts";
import { createCommandRun } from "../../src/foundation/command-message/index.ts";
import { ideaPaths } from "../../src/foundation/coordinates/index.ts";
import { inspectPhaseGuidance } from "../../src/foundation/guidance/index.ts";
import { observeDevice } from "../../src/business/shared/observe-device.ts";
import type { ReadyObservation, SnapshotObservation } from "../../src/business/shared/business-types.ts";
import type { ObservedIdea } from "../../src/business/shared/idea-layout.ts";
import type { IdeaSubmissionsProjection, PhaseSubmissionProjection } from "../../src/foundation/report/types.ts";

const id = "01M36QGPNTXEPP61DA4KP4AVZF";
const primary = "a".repeat(40);
const paths = ideaPaths(id);
const config = { version: 2 as const, primaryRepository: "https://example.test/owner/repository.git", primaryBranch: "main" };
function assertNoLocalizedProblemProse(value: unknown): void {
  if (Array.isArray(value)) {
    for (const item of value) assertNoLocalizedProblemProse(item);
    return;
  }
  if (typeof value !== "object" || value === null) return;
  for (const [key, item] of Object.entries(value)) {
    assert.ok(!["description", "summary", "message", "remediation"].includes(key), key);
    assertNoLocalizedProblemProse(item);
  }
}
function idea(state: string): ObservedIdea {
  const revisions = { idealRevision: "b".repeat(40), implementationRevision: "c".repeat(40), deploymentRevision: "d".repeat(40) };
  return {
    id, alias: "fixture", state, revisions, ...revisions,
    status: { version: 1, id, language: "zh-CN" },
    path: paths.ideaPath, relativePath: paths.ideaPath,
    statusPath: paths.statusPath, ledgerPath: paths.ledgerPath,
    eventDigest: "e".repeat(40), control: { owner: "downstream", lastTransfer: null },
    worlds: {
      idealRevision: { name: "idealRevision", displayName: "Ideal", path: paths.idealPath, documentPath: paths.ideaDocumentPath },
      implementationRevision: { name: "implementationRevision", displayName: "Inner", path: paths.innerPath, documentPath: paths.implementationDocumentPath },
      deploymentRevision: { name: "deploymentRevision", displayName: "Outer", path: paths.outerPath, documentPath: paths.deploymentDocumentPath },
    },
  };
}
function submissions(selected: ObservedIdea, phase: "ideal" | "inner" | "outer", state: "unsubmitted" | "submitted" | "stale"): IdeaSubmissionsProjection {
  const make = (key: "ideal" | "inner" | "outer"): PhaseSubmissionProjection => {
    const field = key === "ideal" ? "idealRevision" : key === "inner" ? "implementationRevision" : "deploymentRevision";
    const preceding = ["ideal", "inner", "outer"].indexOf(key) < ["ideal", "inner", "outer"].indexOf(phase);
    const current = selected.revisions[field];
    return {
      phase: key,
      submit: key === "ideal" ? "submitIdeal" as const : key === "inner" ? "submitInner" as const : "submitOuter" as const,
      decision: key === "ideal" ? "acceptIdeal" as const : key === "inner" ? "acceptInner" as const : "acceptOuter" as const,
      state: preceding ? "accepted" as const : key === phase ? state : "unsubmitted" as const,
      revision: { field, value: current },
      ...(preceding ? { acceptedRevision: current, submittedRevision: current }
        : key === phase && state !== "unsubmitted" ? { submittedRevision: state === "stale" ? "f".repeat(40) : current } : {}),
    };
  };
  return { current: phase, ideal: make("ideal"), inner: make("inner"), outer: make("outer") };
}
function ready(selected = idea("implementing")): ReadyObservation {
  return {
    config, contentLanguage: "en-US", findings: [], layout: { diagnostics: [], ideas: [selected] },
    outputLanguage: "en-US", projectReady: true,
    observation: {
      state: "project-ready", root: "D:\\fixture", outputLanguage: "en-US",
      configuration: config, version: { type: "worktree" }, problems: [],
      ideas: { counts: { [selected.state]: 1 }, activeIdeas: [] },
    },
  };
}
function harness(snapshot: SnapshotObservation = ready(), blockRepository = false) {
  const calls: string[] = [];
  const observations: ObjectiveObservation[] = [];
  const ports: NonNullable<Parameters<typeof whatsNextUseCase>[1]> = {
    createCommandRun: (intent) => createCommandRun(intent, { eventSink: () => {} }),
    observeSnapshot: async () => { calls.push("snapshot"); return snapshot; },
    assessRepositoryReadiness: async ({ observed }) => {
      calls.push("repository");
      return blockRepository ? {
        ready: false,
        observation: { ...observed.observation, state: "repository-sync-required", problems: [{ type: "worktree-changes", summary: "Dirty candidate." }] },
        instructions: "Synchronize the exact primary first.",
      } : {
        ready: true, observation: observed.observation, primary, head: primary,
        branch: { branch: "topic", remote: "origin", repository: config.primaryRepository, upstreamBranch: "main" },
      };
    },
    observeDevice,
    observeIdea: async () => {
      if (snapshot.layout === null) throw new Error("Project must precede local Idea sampling.");
      return { ...snapshot.layout, project: undefined };
    },
    inspectWorktreeContext: () => ({ kind: "worktree", root: "D:\\fixture" }),
    worktreeSnapshot: () => ({ tree: "local-guidance-tree" }),
    createSilvermoonObjectiveLoader: (checks) => {
      const wrapped = { ...checks };
      for (const key of Object.keys(checks) as SilvermoonCheckId[]) {
        wrapped[key] = async (subject) => { calls.push(key); return checks[key](subject); };
      }
      return createSilvermoonObjectiveLoader(wrapped, { executeEntries: false });
    },
    probeObjective: async (instance) => {
      const sample = await instance.probe();
      observations.push(sample);
      return sample;
    },
  };
  const options = {
    root: "D:\\fixture", idea: "fixture",
    guidanceInspector: async () => ({ state: "valid" as const, diagnostics: [] }),
    guidanceReader: async ({ phase, snapshotTree }: Parameters<typeof inspectPhaseGuidance>[0]) => {
      calls.push(`guidance:${phase}:${snapshotTree}`);
      return { state: "valid" as const, diagnostics: [] };
    },
  };
  return { calls, observations, ports, options };
}

test("Guide-driven navigation preserves four projections and direct instance ownership", async () => {
  const context = harness();
  const report = await whatsNextUseCase(context.options, context.ports);
  assert.deepEqual(Object.keys(report), ["intention", "observation", "actions", "response"]);
  assert.equal(report.observation.state, "idea-selected");
  assert.equal(report.observation.outputLanguage, "zh-CN");
  assert.equal(report.response.details?.contentLanguage, "zh-CN");
  const sample = context.observations.at(-1)!;
  assert.equal(sample.position.level.id, "implementation-unsubmitted");
  assert.equal(sample.position.owner.guide.manifestUri, SILVERMOON_OBJECTIVE_URIS.idea);
  assert.equal(sample.position.owner.prerequisite?.guide.manifestUri, SILVERMOON_OBJECTIVE_URIS.project);
  assert.equal(sample.position.owner.language, "zh-CN");
  assert.equal(sample.position.owner.prerequisite?.language, "zh-CN");
  if (report.response.kind !== "next-steps") assert.fail("Expected next steps.");
  assert.match(report.response.nextSteps.map(({ text }) => text).join("\n"), /submitInner/);
  assert.deepEqual(report.actions, []);
});

test("concurrent command instances do not share snapshot or lifecycle state", async () => {
  const first = harness(ready(idea("preparing")));
  const second = harness(ready(idea("deploying")));
  const reports = await Promise.all([
    whatsNextUseCase(first.options, first.ports), whatsNextUseCase(second.options, second.ports),
  ]);
  assert.equal(first.observations.at(-1)?.position.level.id, "ideal-unsubmitted");
  assert.equal(second.observations.at(-1)?.position.level.id, "deployment-unsubmitted");
  assert.notEqual(first.observations[0]?.position.owner, second.observations[0]?.position.owner);
  assert.ok(reports.every(({ observation }) => observation.state === "idea-selected"));
});

test("project and repository failures gate Idea checks and retain report diagnostics", async () => {
  const unavailable: SnapshotObservation = {
    config: null, contentLanguage: "en-US", findings: [{ instruction: "Repair schema." }], layout: null,
    outputLanguage: "en-US", projectReady: false,
    observation: { state: "project-setup-required", root: "D:\\fixture", outputLanguage: "en-US",
      observedThrough: "configuration", problems: [{ type: "schema-invalid", summary: "Unsupported schema." }] },
  };
  const first = harness(unavailable);
  const blocked = await whatsNextUseCase(first.options, first.ports);
  assert.deepEqual(first.calls, ["snapshot", "project-config-valid"]);
  assert.equal(first.observations[0]?.position.level.id, "configuration-invalid");
  assert.equal(first.observations[0]?.position.failingCheck, "project-config-valid");
  const projectParameters = first.observations[0]?.position.problems[0]?.parameters;
  assert.deepEqual(projectParameters, {
    state: "project-setup-required",
    problemTypes: ["schema-invalid"],
  });
  assertNoLocalizedProblemProse(projectParameters);
  assert.doesNotMatch(JSON.stringify(projectParameters), /Unsupported schema/);
  assert.equal(blocked.observation.problems[0]?.summary, "Unsupported schema.");
  assert.equal(blocked.observation.state, "project-setup-required");
  assert.equal(blocked.response.objective?.target, "idea");
  assert.equal(blocked.response.objective?.owner, "project");
  assert.equal(blocked.response.objective?.failingCheck, "project-config-valid");
  assert.deepEqual(blocked.response.objective?.problems, [{
    id: "project",
    parameters: projectParameters!,
  }]);
  assert.deepEqual(
    blocked.response.objective?.references.map(({ id }) => id),
    ["levels/configuration-invalid", "checks/project-config-valid", "problems/project"],
  );
  const second = harness(ready(), true);
  const sync = await whatsNextUseCase(second.options, second.ports);
  assert.equal(second.observations[0]?.position.level.id, "repository-unready");
  assert.equal(second.observations[0]?.position.failingCheck, "repository-worktree-clean");
  assert.equal(second.observations[0]?.position.owner.guide.manifestUri, SILVERMOON_OBJECTIVE_URIS.project);
  const repositoryParameters = second.observations[0]?.position.problems[0]?.parameters;
  assert.deepEqual(repositoryParameters, {
    state: "repository-sync-required",
    problemTypes: ["worktree-changes"],
    root: "D:\\fixture",
    head: null,
    primary: null,
    branch: null,
  });
  assertNoLocalizedProblemProse(repositoryParameters);
  assert.doesNotMatch(JSON.stringify(repositoryParameters), /Dirty candidate/);
  assert.ok(!second.calls.includes("idea-metadata-valid"));
  assert.equal(sync.observation.state, "repository-sync-required");
  assert.equal(sync.observation.problems[0]?.summary, "Dirty candidate.");
});

test("no selector stays Project-only even for one Idea; invalid selectors do not silently fall back", async () => {
  for (const selector of [undefined, "missing", ""]) {
    const context = harness();
    const { idea: _idea, ...options } = context.options;
    const report = await whatsNextUseCase({ ...options, ...(selector === undefined ? {} : { idea: selector }) }, context.ports);
    assert.equal(report.observation.state, selector === undefined ? "objective-ready" : "idea-not-found");
    assert.equal(context.observations[0]?.position.level.id, "terminal");
    assert.equal(context.observations[0]?.position.owner.guide.manifestUri, SILVERMOON_OBJECTIVE_URIS.project);
    assert.ok(!context.calls.includes("idea-metadata-valid"));
    assert.ok(context.calls.includes("project-primary-guidance-valid"));
    if (selector === undefined) {
      assert.equal(report.response.kind, "objective");
      if (report.response.kind === "objective") {
        assert.deepEqual(report.response.nextSteps, []);
        assert.deepEqual(report.response.objective, {
          target: "project",
          owner: "project",
          level: "terminal",
          failingCheck: null,
          terminal: true,
          problems: [],
          references: [{
            kind: "level",
            id: "levels/terminal",
            title: "Objective attained",
            description: "All checks passed in this probe.",
            content: [
              "## Meaning",
              "",
              "This terminal means every advancement check required by the current probe passed.",
              "It is a sampled conclusion, not permanent truth, a real-world mutation, or human authorization.",
            ].join("\n"),
            command: "silvermoon reference page project levels/terminal --language en-US",
          }],
        });
      }
    }
  }
});

test("outside-worktree bare navigation targets Device and stops at terminal", async () => {
  const context = harness();
  const { idea: _idea, ...options } = context.options;
  const report = await whatsNextUseCase(options, {
    ...context.ports,
    inspectWorktreeContext: () => ({
      kind: "outside-worktree", root: "D:\\outside",
    }),
    observeDevice: async () => ({
      runtime: { source: "global", version: "0.5.0" },
      readiness: {
        runtime: { source: "global", version: "0.5.0" },
        skill: {
          status: "ready", expectedRoot: "D:\\runtime\\skills\\silvermoon",
          paths: ["D:\\home\\.agents\\skills\\silvermoon"],
        },
        update: {
          status: "current", currentVersion: "0.5.0", source: "cache",
        },
      },
      globalConfig: { path: "D:\\home\\.silvermoon\\config.yaml", present: true, valid: true },
      diagnostics: [],
      user: {
        configPath: "D:\\home\\.silvermoon\\config.yaml",
        config: { preferredLanguage: "en-US" },
        diagnostics: [],
      },
    } as unknown as Awaited<ReturnType<typeof observeDevice>>),
  });
  assert.equal(report.observation.state, "objective-ready");
  assert.equal(report.response.kind, "objective");
  if (report.response.kind !== "objective") assert.fail("Expected Device Objective response.");
  assert.deepEqual(report.response.objective, {
    target: "device",
    owner: "device",
    level: "terminal",
    failingCheck: null,
    terminal: true,
    problems: [],
    references: [{
      kind: "level",
      id: "levels/terminal",
      title: "Objective attained",
      description: "All checks passed in this probe.",
      content: [
        "## Meaning",
        "",
        "This terminal means every advancement check required by the current probe passed.",
        "It is a sampled conclusion, not permanent truth, a real-world mutation, or human authorization.",
      ].join("\n"),
      command: "silvermoon reference page device levels/terminal --language en-US",
    }],
  });
  assert.deepEqual(report.response.nextSteps, []);
  assert.ok(!context.calls.includes("snapshot"));
  assert.equal(context.observations[0]?.position.owner.guide.manifestUri, SILVERMOON_OBJECTIVE_URIS.device);
});

test("Project validates every phase, missing guidance is allowed and another invalid phase blocks", async () => {
  const context = harness();
  const report = await whatsNextUseCase({
    ...context.options,
    guidanceInspector: async () => ({ state: "invalid", diagnostics: [{ code: "guidance.invalid", level: "error",
      message: "Invalid unselected phase.", path: "guidance/deploying.md", remediation: "Repair phase guidance." }] }),
  }, context.ports);
  assert.equal(context.observations[0]?.position.level.id, "project-unprepared");
  assert.equal(context.observations[0]?.position.owner.guide.manifestUri, SILVERMOON_OBJECTIVE_URIS.project);
  assert.ok(!context.calls.includes("repository"));
  assert.equal(report.observation.state, "phase-guidance-invalid");
  assert.equal(report.observation.problems[0]?.type, "guidance-invalid");
  const guidanceParameters = context.observations[0]?.position.problems[0]?.parameters;
  assert.deepEqual(guidanceParameters, {
    diagnostics: [{ code: "guidance.invalid", path: "guidance/deploying.md" }],
  });
  assertNoLocalizedProblemProse(guidanceParameters);
  assert.doesNotMatch(JSON.stringify(guidanceParameters), /Invalid unselected phase|Repair phase guidance/);
  assert.match(report.observation.problems[0]?.summary ?? "", /Invalid unselected phase\./);
});

test("v2 exact submission and acceptance occupy separate levels; stale submission returns to unsubmitted", async () => {
  for (const [phase, lifecycle, prefix] of [
    ["ideal", "preparing", "ideal"], ["inner", "implementing", "implementation"], ["outer", "deploying", "deployment"],
  ] as const) {
    for (const state of ["unsubmitted", "submitted", "stale"] as const) {
      const selected = idea(lifecycle);
      selected.submissions = submissions(selected, phase, state);
      const context = harness(ready(selected));
      await whatsNextUseCase(context.options, context.ports);
      assert.equal(context.observations[0]?.position.level.id, `${prefix}-${state === "submitted" ? "unaccepted" : "unsubmitted"}`);
      if (state !== "submitted") {
        assert.equal(context.observations[0]?.position.problems[0]?.parameters.revision,
          selected.revisions[phase === "ideal" ? "idealRevision"
            : phase === "inner" ? "implementationRevision" : "deploymentRevision"]);
      }
    }
  }
});

test("v1 lifecycle remains compatible; completed is terminal and abandoned stops without becoming completed", async () => {
  for (const [state, level] of [
    ["preparing", "ideal-unsubmitted"], ["implementing", "implementation-unsubmitted"],
    ["deploying", "deployment-unsubmitted"], ["completed", "terminal"], ["abandoned", "terminal"],
  ]) {
    const context = harness(ready(idea(state!)));
    const report = await whatsNextUseCase(context.options, context.ports);
    assert.equal(context.observations[0]?.position.level.id, level);
    assert.equal(report.observation.state, "idea-selected");
    if (level === "terminal") {
      assert.ok("nextSteps" in report.response);
      if ("nextSteps" in report.response) assert.deepEqual(report.response.nextSteps, []);
      assert.equal(report.response.objective?.terminal, true);
      assert.equal(report.response.objective?.target, "idea");
    }
    if (state === "abandoned") {
      assert.ok(!context.calls.includes("idea-ideal-submitted"));
      assert.ok(!context.calls.includes("idea-metadata-valid"));
      assert.equal(context.observations[0]?.position.owner.guide.manifestUri, SILVERMOON_OBJECTIVE_URIS.project);
    }
  }
});

test("primary guidance is checked again, and active content remains bound to primary", async () => {
  const context = harness();
  const report = await whatsNextUseCase({
    ...context.options,
    guidanceReader: async ({ phase, snapshotTree }) => ({
      state: "valid", diagnostics: [], guidance: { phase, path: `.silvermoon/guidance/${phase}.md`,
        contentRevision: String(snapshotTree), content: "Do not execute inert text." },
    }),
  }, context.ports);
  if (report.response.kind !== "next-steps") assert.fail("Expected next steps.");
  assert.equal(report.response.guidance?.contentRevision, primary);
  assert.ok(context.calls.includes("project-guidance-valid"));
  assert.ok(context.calls.includes("project-primary-guidance-valid"));
});

test("navigation defects and typed instance configuration errors propagate", async () => {
  const context = harness();
  const bug = new Error("snapshot defect");
  await assert.rejects(whatsNextUseCase(context.options, {
    ...context.ports, observeSnapshot: async () => { throw bug; },
  }), (caught) => caught === bug);
  assert.deepEqual(context.observations, []);
});

test("unknown selectors do not read active Idea metadata", async () => {
  const snapshot = ready();
  snapshot.observation.ideas = { counts: { implementing: 1 }, activeIdeas: [{ id, state: "implementing" }] };
  const context = harness(snapshot);
  const options = { ...context.options, idea: "missing" };
  const report = await whatsNextUseCase(options, context.ports);
  assert.equal(report.observation.state, "idea-not-found");
  assert.deepEqual(report.observation.candidates, []);
});

test("fresh Idea metadata faults and concurrent changes cannot produce stale lifecycle review", async () => {
  for (const changed of [false, true]) {
    const context = harness();
    const report = await whatsNextUseCase(context.options, {
      ...context.ports,
      observeIdea: async () => ({
        diagnostics: [], project: undefined,
        ideas: changed ? [{ ...idea("implementing"), eventDigest: "f".repeat(40) }] : [],
      }),
    });
    assert.equal(report.observation.state, changed ? "repository-sync-required" : "project-setup-required");
    assert.ok(!context.calls.includes("idea-ideal-submitted"));
    assert.ok(!("review" in report.response) || report.response.review === undefined);
  }
});
