import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import Ajv2020 from "ajv/dist/2020.js";

import { eventsFromStatus, validateIdeaEvent } from "../../src/events/rules/grammar.js";

test("v2 persistence schemas compile and admit only the nine minimal events", async () => {
  const ajv = new Ajv2020({ strict: true, allErrors: true, formats: { uri: true } });
  for (const path of ["v1/definitions", "v1/idea-status", "v2/config", "v2/idea-event"]) {
    ajv.addSchema(JSON.parse(await readFile(new URL(`../../schema/${path}.schema.json`, import.meta.url), "utf8")));
  }
  const validate = ajv.getSchema("https://github.com/shazhou-ww/silvermoon/raw/refs/heads/main/schema/v2/idea-event.schema.json");
  const events = [...eventsFromStatus({
    version: 1, id: "01M3SJTKFRQ19DP0RPPJACKGMC", alias: "test", language: "zh-CN",
    approvedRevision: "a".repeat(40), implementationAcceptedRevision: "b".repeat(64),
    deploymentAcceptedRevision: "c".repeat(40), abandoned: true,
  }), { sequence: 7, type: "resume" }];
  for (const event of events) {
    assert.equal(validate(event), true, JSON.stringify(validate.errors));
    validateIdeaEvent(event);
    for (const invalid of [{ ...event, recordedAt: "today" }, { ...event, sequence: 0 }]) {
      assert.equal(validate(invalid), false);
      assert.throws(() => validateIdeaEvent(invalid));
    }
  }
  for (const event of [
    { sequence: 1, type: "idea.created" },
    { sequence: 1, type: "abandon", payload: {} },
    { sequence: 1, type: "acceptIdeal", payload: { idealRevision: null } },
    { sequence: 1, type: "setAlias", payload: { alias: "a", language: "en" } },
  ]) assert.equal(validate(event), false, JSON.stringify(event));
  const config = ajv.getSchema("https://github.com/shazhou-ww/silvermoon/raw/refs/heads/main/schema/v2/config.schema.json");
  assert.equal(config({ version: 2, primaryRepository: "https://example.test/a/b", primaryBranch: "main" }), true);
});
