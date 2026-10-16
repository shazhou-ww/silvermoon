import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createSilvermoonObjectiveLoader,
  describeSilvermoonObjectiveLevels,
  SILVERMOON_CHECK_PROBLEMS,
  SILVERMOON_OBJECTIVE_LEVELS,
  SILVERMOON_OBJECTIVE_URIS,
  SILVERMOON_OBJECTIVE_VERSION,
} from "../../src/business/objective-guides.ts";
import type {
  SilvermoonObjectiveCheck,
  SilvermoonObjectiveChecks,
} from "../../src/business/objective-guides.ts";

function checks(failing?: string) {
  const calls: string[] = [];
  const bindings = Object.fromEntries(Object.values(SILVERMOON_OBJECTIVE_LEVELS)
    .flatMap((levels) => levels.flatMap(([, ids]) => ids))
    .map((id): [string, SilvermoonObjectiveCheck] => [id, async () => {
      calls.push(id);
      return id === failing
        ? {
          ok: false,
          problems: [{
            id: SILVERMOON_CHECK_PROBLEMS[id][0],
            parameters: { failingCheck: id },
          }],
        }
        : { ok: true, problems: [] };
    }])) as SilvermoonObjectiveChecks;
  return { bindings, calls };
}

function subject(scope: keyof typeof SILVERMOON_OBJECTIVE_URIS) {
  return scope === "device"
    ? { userHome: "home" }
    : scope === "project"
      ? { root: "project", userHome: "home" }
      : { root: "project", userHome: "home", ideaId: "01M36QGPNTXEPP61DA4KP4AVZF" };
}

test("every bundled Objective retains level and check provenance", async () => {
  for (const scope of ["device", "project", "idea"] as const) {
    for (const [level, ids] of SILVERMOON_OBJECTIVE_LEVELS[scope]) {
      for (const id of ids) {
        const context = checks(id);
        const loader = createSilvermoonObjectiveLoader(context.bindings);
        const spec = await loader.load(SILVERMOON_OBJECTIVE_URIS[scope]);
        const sample = await loader.probe(spec, subject(scope), "zh-CN");
        assert.equal(sample.position.level.id, level, id);
        assert.equal(sample.position.failingCheck, id);
        assert.deepEqual(context.calls.slice(-ids.length), ids);
        assert.equal(sample.position.owner.spec.objectiveId, spec.objectiveId);
        assert.equal(sample.position.owner.readPage("missing").id, "system/404");
      }
    }
  }
});

test("bundled specs use stable Git identities and an exact source commit", async () => {
  const context = checks("device-runtime-linked");
  const loader = createSilvermoonObjectiveLoader(context.bindings);
  const project = await loader.load(SILVERMOON_OBJECTIVE_URIS.project);
  const idea = await loader.load(SILVERMOON_OBJECTIVE_URIS.idea);
  assert.match(project.objectiveId, /^git\+https:/);
  assert.equal(project.version, SILVERMOON_OBJECTIVE_VERSION);
  assert.equal(project.prerequisite?.objectiveId, SILVERMOON_OBJECTIVE_URIS.device);
  assert.equal(project.manifest.prerequisite?.minimumLevelId, "update-unconfirmed");
  assert.equal(idea.prerequisite?.objectiveId, project.objectiveId);

  const blocked = await loader.probe(idea, subject("idea"), "en-US");
  assert.equal(blocked.position.owner.spec.objectiveId, SILVERMOON_OBJECTIVE_URIS.device);
  assert.equal(blocked.position.level.id, "runtime-unready");
  assert.equal(blocked.position.failingCheck, "device-runtime-linked");
  assert.ok(!context.calls.some((id) => id.startsWith("project-") || id.startsWith("idea-")));

  const updateContext = checks("device-update-current");
  const updateLoader = createSilvermoonObjectiveLoader(updateContext.bindings);
  const updateIdea = await updateLoader.load(SILVERMOON_OBJECTIVE_URIS.idea);
  const ready = await updateLoader.probe(updateIdea, subject("idea"), "en-US");
  assert.equal(ready.position.owner.spec.objectiveId, SILVERMOON_OBJECTIVE_URIS.idea);
  assert.equal(ready.position.level.id, "terminal");
  assert.ok(updateContext.calls.includes("device-update-current"));
  assert.ok(updateContext.calls.includes("project-config-valid"));
  assert.ok(updateContext.calls.includes("idea-metadata-valid"));
  assert.equal(
    describeSilvermoonObjectiveLevels(idea).filter(({ levelId }) => levelId === "terminal").length,
    1,
  );
});

test("invalid Idea subjects fail before checks start", async () => {
  const context = checks();
  const loader = createSilvermoonObjectiveLoader(context.bindings);
  const idea = await loader.load(SILVERMOON_OBJECTIVE_URIS.idea);
  for (const invalid of [
    { root: "project", userHome: "home" },
    { root: "project", userHome: "home", ideaId: "alias" },
    { root: "project", userHome: "home", ideaId: "Z".repeat(26) },
    {
      root: "project",
      userHome: "home",
      ideaId: "01M36QGPNTXEPP61DA4KP4AVZF",
      objectiveId: "idea",
    },
  ]) {
    await assert.rejects(loader.probe(idea, invalid, "en-US"), /Invalid subject/);
  }
  assert.deepEqual(context.calls, []);
});
