import assert from "node:assert/strict";
import { test } from "node:test";

import { validBranchName } from "../../src/repository.js";

test("branch validation rejects non-string values without invoking Git", () => {
  for (const value of [null, undefined, 0, false, {}, []]) {
    assert.equal(validBranchName(value), false);
  }
});
