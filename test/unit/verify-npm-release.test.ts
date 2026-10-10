import assert from "node:assert/strict";
import { test } from "node:test";

import { validatePublicationSource } from "../../bin/verify-npm-release.ts";

test("accepts immutable stable and canary publication tags", () => {
  assert.doesNotThrow(() =>
    validatePublicationSource({
      distTag: "latest",
      sourceRef: "refs/tags/npm/silvermoon/v0.5.0",
      version: "0.5.0",
    })
  );
  assert.doesNotThrow(() =>
    validatePublicationSource({
      distTag: "canary",
      sourceRef: "refs/tags/npm/silvermoon/v0.5.0-canary.42.g0123456789ab",
      version: "0.5.0-canary.42.g0123456789ab",
    })
  );
  assert.throws(
    () =>
      validatePublicationSource({
        distTag: "latest",
        sourceRef: "refs/heads/main",
        version: "0.5.0",
      }),
    /must be an immutable release tag/,
  );
  assert.throws(
    () =>
      validatePublicationSource({
        distTag: "canary",
        sourceRef: "refs/tags/npm/silvermoon/v0.5.0",
        version: "0.5.0-canary.42.g0123456789ab",
      }),
    /does not select version/,
  );
});
