import assert from "node:assert/strict";
import { test } from "node:test";

import { whatsNextUseCase } from "../../src/business/whats-next.ts";
import { readWhatsNextModel } from "../../src/business/whats-next-model.ts";
import { createCommandRun } from "../../src/foundation/command-message/index.ts";
import { ideaPaths } from "../../src/foundation/coordinates/index.ts";
import { IdeaMetadataReadError, readIdeaInventoryItem } from "../../src/business/shared/read-idea-inventory-item.ts";
import { assembleProfessionalModel } from "../../src/professional-model/index.ts";
import type { Observation as ModelObservation } from "../../src/professional-model/index.ts";
import type { ReadyObservation, SnapshotObservation } from "../../src/business/shared/business-types.ts";
import type { ObservedIdea } from "../../src/business/shared/idea-layout.ts";

const id = "01M36QGPNTXEPP61DA4KP4AVZF";
const primary = "a".repeat(40);
const paths = ideaPaths(id);
const config = {
  version: 2 as const,
  primaryRepository: "https://example.test/owner/repository.git",
  primaryBranch: "main",
};

function idea(state: string): ObservedIdea {
  const revisions = {
    idealRevision: "b".repeat(40),
    implementationRevision: "c".repeat(40),
    deploymentRevision: "d".repeat(40),
  };
  return {
    id, alias: "fixture", state, revisions, ...revisions,
    status: { version: 1, id, language: "zh-CN" },
    path: paths.ideaPath, relativePath: paths.ideaPath,
    statusPath: paths.statusPath, ledgerPath: paths.ledgerPath,
    eventDigest: "e".repeat(40),
    control: { owner: "downstream", lastTransfer: null },
    worlds: {
      idealRevision: {
        name: "idealRevision", displayName: "Ideal", path: paths.idealPath,
        documentPath: paths.ideaDocumentPath,
      },
      implementationRevision: {
        name: "implementationRevision", displayName: "Inner", path: paths.innerPath,
        documentPath: paths.implementationDocumentPath,
      },
      deploymentRevision: {
        name: "deploymentRevision", displayName: "Outer", path: paths.outerPath,
        documentPath: paths.deploymentDocumentPath,
      },
    },
  };
}

function ready(selected = idea("implementing")): ReadyObservation {
  return {
    config, contentLanguage: "en-US", findings: [],
    layout: { diagnostics: [], ideas: [selected] },
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
  const observations: ModelObservation[] = [];
  const stateRegistrations: number[] = [];
  const ports: NonNullable<Parameters<typeof whatsNextUseCase>[1]> = {
    createCommandRun: (intent) => createCommandRun(intent, { eventSink: () => {} }),
    observeSnapshot: async () => { calls.push("snapshot"); return snapshot; },
    assessRepositoryReadiness: async ({ observed }) => {
      calls.push("repository");
      return blockRepository
        ? {
          ready: false,
          observation: { ...observed.observation, state: "repository-sync-required" },
          instructions: "Synchronize the exact primary first.",
        }
        : {
          ready: true, observation: observed.observation, primary, head: primary,
          branch: { branch: "topic", remote: "origin", repository: config.primaryRepository, upstreamBranch: "main" },
        };
    },
    readIdeaInventoryItem,
    readWhatsNextModel,
    assembleProfessionalModel: (source, createChecks) => {
      const model = assembleProfessionalModel(source, (useState) => {
        let count = 0;
        const checks = createChecks((initial) => { count += 1; return useState(initial); });
        stateRegistrations.push(count);
        return Object.fromEntries(Object.entries(checks).map(([name, check]) => [
          name, async (target) => { calls.push(name); return check(target); },
        ]));
      });
      return {
        ...model,
        async observe(target) {
          const observed = await model.observe(target);
          observations.push(observed);
          return observed;
        },
      };
    },
  };
  const options = {
    root: "D:\\fixture", idea: "fixture",
    guidanceReader: async () => {
      calls.push("guidance-reader");
      return { state: "valid" as const, diagnostics: [] };
    },
  };
  return { calls, observations, stateRegistrations, ports, options };
}

test("real whats-next use case is driven by the ordered model and preserves the four projections", async () => {
  const context = harness();
  const report = await whatsNextUseCase(context.options, context.ports);
  assert.deepEqual(context.calls, [
    "project", "snapshot", "repository", "repository", "selection",
    "guidance", "guidance-reader", "ideal", "inner",
  ]);
  assert.deepEqual(context.observations.map(({ level }) => level), [4]);
  assert.deepEqual(context.stateRegistrations, [5]);
  assert.equal(context.observations[0]?.problems[0]?.code, "inner");
  assert.deepEqual(Object.keys(report), ["intention", "observation", "actions", "response"]);
  assert.equal(report.observation.state, "idea-selected");
  assert.equal(report.observation.outputLanguage, "zh-CN");
  assert.equal(report.response.details?.contentLanguage, "zh-CN");
  if (report.response.kind !== "next-steps") assert.fail("Expected next steps.");
  assert.match(report.response.nextSteps.map(({ text }) => text).join("\n"), /submitInner/);
  assert.deepEqual(report.actions, []);
});

test("reads the standalone YAML and propagates read or parsing errors before any check", async () => {
  const source = await readWhatsNextModel();
  assert.match(source, /^target:\r?\n/);
  assert.deepEqual(assembleProfessionalModel(source, () => ({})).describe()
    .map(({ level }) => level), [0, 1, 2, 3, 4, 5, 6]);
  const context = harness();
  const unavailable = new Error("standalone YAML unavailable");
  await assert.rejects(whatsNextUseCase(context.options, {
    ...context.ports, readWhatsNextModel: async () => { throw unavailable; },
  }), (caught) => caught === unavailable);
  await assert.rejects(whatsNextUseCase(context.options, {
    ...context.ports, readWhatsNextModel: async () => "levels: [",
  }), /Invalid professional model YAML/);
  assert.deepEqual(context.calls, []);
  assert.deepEqual(context.stateRegistrations, []);
});

test("real navigation state handles stay isolated across concurrent use cases", async () => {
  const preparing = harness(ready(idea("preparing")));
  const deploying = harness(ready(idea("deploying")));
  const [first, second] = await Promise.all([
    whatsNextUseCase(preparing.options, preparing.ports),
    whatsNextUseCase(deploying.options, deploying.ports),
  ]);
  assert.equal(preparing.observations[0]?.level, 3);
  assert.equal(deploying.observations[0]?.level, 5);
  assert.equal(first.observation.state, "idea-selected");
  assert.equal(second.observation.state, "idea-selected");
  if (first.observation.state !== "idea-selected" || second.observation.state !== "idea-selected") {
    assert.fail("Expected independent selected reports.");
  }
  assert.equal(first.observation.selectedIdea.state, "preparing");
  assert.equal(second.observation.selectedIdea.state, "deploying");
  assert.deepEqual(preparing.stateRegistrations, [5]);
  assert.deepEqual(deploying.stateRegistrations, [5]);
});

test("project and repository failures stop later checks without changing report priority", async () => {
  const unavailable: SnapshotObservation = {
    config: null, contentLanguage: "en-US", findings: [{ instruction: "Repair schema." }],
    layout: null, outputLanguage: "en-US", projectReady: false,
    observation: {
      state: "project-setup-required", root: "D:\\fixture", outputLanguage: "en-US",
      observedThrough: "configuration", version: { type: "worktree" },
      problems: [{ type: "schema-invalid", summary: "Unsupported schema." }],
    },
  };
  const project = harness(unavailable);
  const blocked = await whatsNextUseCase(project.options, project.ports);
  assert.deepEqual(project.calls, ["project", "snapshot"]);
  assert.equal(project.observations[0]?.level, 0);
  assert.equal(project.observations[0]?.problems[0]?.description, "schema-invalid: Unsupported schema.");
  assert.equal(blocked.observation.state, "project-setup-required");
  const repository = harness(ready(), true);
  const sync = await whatsNextUseCase(repository.options, repository.ports);
  assert.deepEqual(repository.calls, ["project", "snapshot", "repository", "repository"]);
  assert.equal(repository.observations[0]?.level, 1);
  assert.equal(sync.observation.state, "repository-sync-required");
});

test("unselected and unknown objects stop before guidance without implicit selection", async () => {
  for (const selector of [undefined, "missing", ""]) {
    const context = harness();
    const { idea: _idea, ...options } = context.options;
    const report = await whatsNextUseCase({
      ...options, ...(selector === undefined ? {} : { idea: selector }),
    }, context.ports);
    assert.equal(report.observation.state, selector === undefined ? "navigation-ready" : "idea-not-found");
    assert.equal(context.observations[0]?.level, 2);
    assert.ok(!context.calls.includes("guidance"));
  }
});

test("invalid phase guidance stops acceptance checks and returns the original diagnostic", async () => {
  const context = harness();
  const report = await whatsNextUseCase({
    ...context.options,
    guidanceReader: async () => ({
      state: "invalid",
      diagnostics: [{
        code: "guidance.invalid", level: "error", message: "Invalid phase body.", path: "guidance/implementing.md",
        remediation: "Repair phase guidance.",
      }],
    }),
  }, context.ports);
  assert.equal(context.observations[0]?.level, 2);
  assert.ok(!context.calls.includes("ideal"));
  assert.equal(report.observation.state, "phase-guidance-invalid");
  assert.equal(report.observation.problems[0]?.type, "guidance-invalid");
});

test("lifecycle projections determine levels without inferring acceptance from progress", async () => {
  for (const [state, level] of [
    ["preparing", 3], ["implementing", 4], ["deploying", 5],
    ["completed", 6], ["abandoned", 3],
  ] as const) {
    const context = harness(ready(idea(state)));
    const report = await whatsNextUseCase(context.options, context.ports);
    assert.equal(context.observations[0]?.level, level);
    assert.equal(report.observation.state, "idea-selected");
    if (report.observation.state !== "idea-selected") assert.fail("Expected selected idea.");
    assert.equal(report.observation.selectedIdea.state, state);
    assert.equal(context.calls.includes("guidance-reader"),
      ["preparing", "implementing", "deploying"].includes(state));
    assert.ok(!("review" in report.response) || report.response.review === undefined);
  }
});

test("navigation defects propagate rather than becoming normal model problems", async () => {
  const context = harness();
  const bug = new Error("snapshot defect");
  await assert.rejects(whatsNextUseCase(context.options, {
    ...context.ports, observeSnapshot: async () => { throw bug; },
  }), (caught) => caught === bug);
  assert.deepEqual(context.observations, []);
});

test("metadata I/O unavailability is explicit but metadata programmer defects propagate", async () => {
  const snapshot = ready();
  snapshot.observation.ideas = { counts: { implementing: 1 }, activeIdeas: [{ id, state: "implementing" }] };
  const context = harness(snapshot);
  const { idea: _idea, ...options } = context.options;
  const bug = new Error("metadata defect");
  await assert.rejects(whatsNextUseCase(options, {
    ...context.ports, readIdeaInventoryItem: async () => { throw bug; },
  }), (caught) => caught === bug);
  const report = await whatsNextUseCase(options, {
    ...context.ports,
    readIdeaInventoryItem: async () => {
      throw new IdeaMetadataReadError(id, paths.ideaDocumentPath, new Error("unavailable"));
    },
  });
  assert.equal(report.observation.state, "project-setup-required");
  assert.equal(report.observation.problems[0]?.type, "idea-metadata-unavailable");
  assert.equal(context.observations[0]?.level, 2);
});
