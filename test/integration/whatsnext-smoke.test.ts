import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { whatsNext } from "../../src/business/whats-next.ts";
import { FIRST_ID } from "../helpers/repository.ts";
import { createWhatsNextTestHelpers } from "../helpers/whatsnext.ts";

const { fixture } = createWhatsNextTestHelpers(afterEach);

test("selects one preparing idea through a real repository", async () => {
  const repository = await fixture();

  const report = await whatsNext({
    idea: FIRST_ID,
    root: repository.root,
    userHome: repository.base,
  });

  assert.equal(report.observation.state, "idea-selected");
  if (report.observation.state !== "idea-selected") {
    assert.fail("expected a selected idea");
  }
  assert.equal(report.observation.selectedIdea.state, "preparing");
  assert.match(report.observation.selectedIdea.eventDigest ?? "", /^[0-9a-f]{40}$/);
  assert.equal(report.response.kind, "next-steps");
  if (report.response.kind !== "next-steps") {
    assert.fail("selected idea must return next steps");
  }
  const response = report.response.nextSteps.map(({ text }) => text).join("\n");
  assert.match(response, /Implementation\.md/);
  assert.match(response, /submitIdeal/);
});
