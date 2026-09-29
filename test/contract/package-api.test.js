import assert from "node:assert/strict";
import { test } from "node:test";

import * as silvermoon from "../../src/index.js";

test("does not expose the removed criteria evidence contract", () => {
  assert.equal(Object.hasOwn(silvermoon, "implementationCriterionIds"), false);
  assert.equal(Object.hasOwn(silvermoon, "verifyCriteriaEvidence"), false);
});

test("exports the versioned command event model and pure response API", () => {
  assert.equal(silvermoon.DOMAIN_MESSAGE_SCHEMA_VERSION, 1);
  assert.equal(silvermoon.TRACE_SCHEMA_VERSION, 2);
  for (const name of [
    "CommandRun",
    "DomainInvariantError",
    "driveCommand",
    "initialInternalObservation",
    "projectActions",
    "projectIntention",
    "projectPublicObservation",
    "projectReport",
    "reduceObservation",
    "renderResponse",
    "replayObservation",
    "respond",
  ]) {
    assert.equal(typeof silvermoon[name], "function", name);
  }
});
