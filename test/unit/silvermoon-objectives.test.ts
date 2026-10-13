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
        ? { pass: false, problems: [{ id: "project", parameters: { description: `Failed ${id}` } }] }
        : { pass: true };
    }])) as SilvermoonObjectiveChecks;
  return { bindings, calls };
}

test("every scope advancement stops at its declared first failing check", async () => {
  for (const scope of ["device", "project", "idea"] as const) {
    for (const [level, ids] of SILVERMOON_OBJECTIVE_LEVELS[scope]) {
      for (const id of ids) {
        const context = checks(id);
        const loader = createSilvermoonObjectiveLoader(context.bindings);
        const guide = await loader.load(SILVERMOON_OBJECTIVE_URIS[scope]);
        const created = guide.createInstance({
          subject: scope === "device" ? { userHome: "home" }
            : scope === "project" ? { root: "project", userHome: "home" }
            : { root: "project", userHome: "home", ideaId: "01M36QGPNTXEPP61DA4KP4AVZF" },
          language: "zh-CN",
        });
        if (!created.ok) assert.fail("Expected valid instance.");
        const sample = await created.instance.probe();
        assert.equal(sample.current.id, level, id);
        assert.equal(context.calls.at(-1), id);
        assert.equal(sample.current.instance.guide, guide);
        assert.equal((await sample.current.instance.readPage("missing")).id, "system/404");
      }
    }
  }
});

test("Device is independent, Project has no prerequisite and Idea directly references cached Project", async () => {
  const context = checks("device-update-current");
  const loader = createSilvermoonObjectiveLoader(context.bindings);
  const project = await loader.load(SILVERMOON_OBJECTIVE_URIS.project);
  const idea = await loader.load(SILVERMOON_OBJECTIVE_URIS.idea);
  assert.equal(project.prerequisite, null);
  assert.equal(idea.prerequisite?.guide, project);
  const created = idea.createInstance({ subject: { root: "project", userHome: "home", ideaId: "01M36QGPNTXEPP61DA4KP4AVZF" } });
  if (!created.ok) assert.fail("Expected instance.");
  assert.equal((await created.instance.probe()).current.id, "terminal");
  assert.ok(context.calls.every((id) => !id.startsWith("device-")));
  assert.equal(created.instance.describeLevels()[0]?.id, "configuration-invalid");
  assert.equal(created.instance.describeLevels().filter(({ id }) => id === "terminal").length, 1);
});

test("the Idea domain requires a valid resolved ULID, not an optional selector or objective ID", async () => {
  const loader = createSilvermoonObjectiveLoader(checks().bindings);
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
