import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createSilvermoonObjectiveLoader, SILVERMOON_OBJECTIVE_LEVELS, SILVERMOON_OBJECTIVE_URIS,
} from "../../src/business/objective-guides.ts";
import type {
  SilvermoonObjectiveCheck, SilvermoonObjectiveChecks,
} from "../../src/business/objective-guides.ts";

function checks(failing?: string) {
  const calls: string[] = [];
  const bindings = Object.fromEntries(Object.values(SILVERMOON_OBJECTIVE_LEVELS)
    .flatMap((levels) => levels.flatMap(([, ids]) => ids))
    .map((id): [string, SilvermoonObjectiveCheck] => [id, async () => {
      calls.push(id);
      return id === failing
        ? { pass: false, problems: [{ id: "project", parameters: { failingCheck: id } }] }
        : { pass: true };
    }])) as SilvermoonObjectiveChecks;
  return { bindings, calls };
}

test("every scope aggregates its failed level serially and retains first failure provenance", async () => {
  for (const scope of ["device", "project", "idea"] as const) {
    for (const [level, ids] of SILVERMOON_OBJECTIVE_LEVELS[scope]) {
      for (const id of ids) {
        const context = checks(id);
        const loader = createSilvermoonObjectiveLoader(context.bindings, { executeEntries: false });
        const guide = await loader.load(SILVERMOON_OBJECTIVE_URIS[scope]);
        const created = guide.createInstance({
          subject: scope === "device" ? { userHome: "home" }
            : scope === "project" ? { root: "project", userHome: "home" }
            : { root: "project", userHome: "home", ideaId: "01M36QGPNTXEPP61DA4KP4AVZF" },
          language: "zh-CN",
        });
        if (!created.ok) assert.fail("Expected valid instance.");
        const sample = await created.instance.probe();
        assert.equal(sample.position.level.id, level, id);
        assert.equal(sample.position.failingCheck, id);
        assert.deepEqual(context.calls.slice(-ids.length), ids);
        assert.equal(sample.position.owner.guide, guide);
        assert.equal((await sample.position.owner.readPage("missing")).id, "system/404");
      }
    }
  }
});

test("Project requires Device readiness through skill and Idea retains the single prerequisite chain", async () => {
  const blockedContext = checks("device-runtime-linked");
  const loader = createSilvermoonObjectiveLoader(blockedContext.bindings, { executeEntries: false });
  assert.equal(new URL(SILVERMOON_OBJECTIVE_URIS.device).protocol, "file:");
  assert.match(new URL(SILVERMOON_OBJECTIVE_URIS.project).pathname, /\/objectives\/project\/manifest\.yaml$/);
  const project = await loader.load(SILVERMOON_OBJECTIVE_URIS.project);
  const idea = await loader.load(SILVERMOON_OBJECTIVE_URIS.idea);
  assert.equal(project.prerequisite?.guide.manifestUri, SILVERMOON_OBJECTIVE_URIS.device);
  assert.equal(project.prerequisite?.minimumLevelId, "update-unconfirmed");
  assert.equal(idea.prerequisite?.guide, project);
  const created = idea.createInstance({ subject: { root: "project", userHome: "home", ideaId: "01M36QGPNTXEPP61DA4KP4AVZF" } });
  if (!created.ok) assert.fail("Expected instance.");
  const blocked = await created.instance.probe();
  assert.equal(blocked.position.owner.guide.manifestUri, SILVERMOON_OBJECTIVE_URIS.device);
  assert.equal(blocked.position.level.id, "runtime-unready");
  assert.equal(blocked.position.failingCheck, "device-runtime-linked");
  assert.ok(!blockedContext.calls.some((id) => id.startsWith("project-") || id.startsWith("idea-")));

  const updateContext = checks("device-update-current");
  const updateLoader = createSilvermoonObjectiveLoader(updateContext.bindings, { executeEntries: false });
  const updateIdea = await updateLoader.load(SILVERMOON_OBJECTIVE_URIS.idea);
  const updateCreated = updateIdea.createInstance({
    subject: { root: "project", userHome: "home", ideaId: "01M36QGPNTXEPP61DA4KP4AVZF" },
  });
  if (!updateCreated.ok) assert.fail("Expected update-tolerant instance.");
  const ready = await updateCreated.instance.probe();
  assert.equal(ready.position.owner.guide.manifestUri, SILVERMOON_OBJECTIVE_URIS.idea);
  assert.equal(ready.position.level.id, "terminal");
  assert.ok(updateContext.calls.includes("device-update-current"));
  assert.ok(updateContext.calls.includes("project-config-valid"));
  assert.ok(updateContext.calls.includes("idea-metadata-valid"));
  assert.equal(created.instance.describeLevels()[0]?.id, "configuration-invalid");
  assert.equal(created.instance.describeLevels().filter(({ id }) => id === "terminal").length, 1);
});

test("the Idea domain requires a valid resolved ULID, not an optional selector or objective ID", async () => {
  const loader = createSilvermoonObjectiveLoader(checks().bindings, { executeEntries: false });
  const idea = await loader.load(SILVERMOON_OBJECTIVE_URIS.idea);
  for (const subject of [
    { root: "project", userHome: "home" },
    { root: "project", userHome: "home", ideaId: "alias" },
    { root: "project", userHome: "home", ideaId: "Z".repeat(26) },
    { root: "project", userHome: "home", ideaId: "01M36QGPNTXEPP61DA4KP4AVZF", objectiveId: "idea" },
  ]) {
    const result = idea.createInstance({ subject });
    if (result.ok) assert.fail("Invalid subject must fail.");
    assert.equal(result.error.type, "invalid-subject");
  }
});
