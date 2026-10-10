import assert from "node:assert/strict";
import {
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  stageNpmCanary,
  validateCanaryVersion,
} from "../../bin/stage-npm-canary.ts";

test("validates and stages a canary without changing the source release line", async () => {
  assert.equal(
    validateCanaryVersion(
      "0.5.0",
      "0.5.0-canary.42.g0123456789ab",
    ),
    "0.5.0-canary.42.g0123456789ab",
  );
  for (const version of [
    "0.5.1-canary.42.g0123456789ab",
    "0.5.0-rc.42.g0123456789ab",
    "0.5.0-canary.042.g0123456789ab",
    "0.5.0-canary.42.g0123456",
  ]) {
    assert.throws(
      () => validateCanaryVersion("0.5.0", version),
      /Canary version/,
    );
  }

  const root = await mkdtemp(join(tmpdir(), "silvermoon-canary-stage-"));
  try {
    const manifestPath = join(root, "package.json");
    await writeFile(
      manifestPath,
      `${JSON.stringify({ name: "silvermoon", version: "0.5.0" }, null, 2)}\n`,
    );
    await stageNpmCanary({
      packageDirectory: root,
      version: "0.5.0-canary.42.g0123456789ab",
    });
    const staged = JSON.parse(await readFile(manifestPath, "utf8"));
    assert.deepEqual(staged, {
      name: "silvermoon",
      version: "0.5.0-canary.42.g0123456789ab",
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
