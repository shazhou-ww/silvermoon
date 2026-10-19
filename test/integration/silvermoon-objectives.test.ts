import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createSilvermoonObjectiveLoader,
  SILVERMOON_OBJECTIVE_LEVELS,
  SILVERMOON_OBJECTIVE_URIS,
} from "../../src/business/objective-guides.ts";
import type {
  SilvermoonCheckId,
  SilvermoonObjectiveCheck,
  SilvermoonObjectiveChecks,
} from "../../src/business/objective-guides.ts";

test("bundled Silvermoon Pilot loads packaged resources and runs memory probes", async () => {
  const bindings = Object.fromEntries(Object.values(SILVERMOON_OBJECTIVE_LEVELS)
    .flatMap((levels) => levels.flatMap(([, ids]) => ids))
    .map((id): [SilvermoonCheckId, SilvermoonObjectiveCheck] => [id, async () =>
      id === "device-config-valid"
        ? {
          ok: false,
          problems: [{
            id: "device-configuration",
            parameters: { configurationPath: "config.yaml" },
          }],
        }
        : { ok: true, problems: [] }])) as SilvermoonObjectiveChecks;
  const loader = createSilvermoonObjectiveLoader(bindings);
  const spec = await loader.load(SILVERMOON_OBJECTIVE_URIS.device);
  const observation = await loader.probe(spec, { userHome: "home" }, "zh-CN");
  assert.equal(observation.position.level.id, "configuration-invalid");
  assert.equal(observation.position.failingCheck, "device-config-valid");
  assert.equal(observation.position.problems[0]?.id, "device-configuration");
  assert.match(observation.position.owner.readPage("checks/device-config-valid").content, /检查内容/);
});
