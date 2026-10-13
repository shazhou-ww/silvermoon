import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createSilvermoonObjectiveLoader, SILVERMOON_OBJECTIVE_LEVELS,
  SILVERMOON_OBJECTIVE_URIS,
} from "../../src/business/objective-guides.ts";
import type {
  SilvermoonCheckId, SilvermoonObjectiveCheck, SilvermoonObjectiveChecks,
} from "../../src/business/objective-guides.ts";

test("bundled Silvermoon Guide loads real resources and executes its real check entry", async () => {
  const bindings = Object.fromEntries(Object.values(SILVERMOON_OBJECTIVE_LEVELS)
    .flatMap((levels) => levels.flatMap(([, ids]) => ids))
    .map((id): [SilvermoonCheckId, SilvermoonObjectiveCheck] => [id, async () =>
      id === "device-config-valid"
        ? {
          pass: false,
          problems: [{ id: "device-configuration", parameters: { description: "Repair configuration." } }],
        }
        : { pass: true }])) as SilvermoonObjectiveChecks;
  const loader = createSilvermoonObjectiveLoader(bindings);
  const guide = await loader.load(SILVERMOON_OBJECTIVE_URIS.device);
  const created = guide.createInstance({ subject: { userHome: "home" }, language: "zh-CN" });
  if (!created.ok) assert.fail("Expected bundled Guide instance.");
  const observation = await created.instance.probe();
  assert.equal(observation.current.id, "configuration-invalid");
  assert.equal(observation.problems[0]?.id, "device-configuration");
  assert.match((await created.instance.readPage("checks/device-config-valid")).content, /检查内容/);
});
