import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createReleasePlan,
  deriveNpmDistTag,
  formatGitHubOutput,
  observeVersionPublication,
  parseReleaseTag,
} from "../../bin/prepare-npm-release.ts";

const commit = "a".repeat(40);

function manifest(version = "0.1.1") {
  return {
    name: "silvermoon",
    version,
    publishConfig: {
      access: "public",
      registry: "https://registry.npmjs.org/",
    },
  };
}

function plan(overrides = {}) {
  return createReleasePlan({
    commit,
    manifest: manifest(),
    reachableFromPrimary: true,
    tag: "npm/silvermoon/v0.1.1",
    ...overrides,
  });
}

test("selects the allowlisted package from a canonical stable release tag", () => {
  assert.deepEqual(plan(), {
    commit,
    distTag: "latest",
    packageDirectory: ".",
    packageName: "silvermoon",
    releaseKey: "silvermoon",
    version: "0.1.1",
  });
});

test("rejects malformed tags and unknown release keys", () => {
  for (const tag of ["v0.1.1", "npm/silvermoon/0.1.1", "npm/silvermoon/v01.1.0"]) {
    assert.throws(() => parseReleaseTag(tag));
  }
  assert.throws(
    () => plan({ tag: "npm/unknown/v0.1.1" }),
    /Unknown npm release key: unknown/,
  );
});

test("requires the allowlisted package identity and requested manifest version", () => {
  assert.throws(
    () => plan({ manifest: { ...manifest(), name: "other-package" } }),
    /Package name mismatch/,
  );
  assert.throws(
    () => plan({ manifest: { ...manifest(), version: "0.1.0" } }),
    /Version mismatch.*0\.1\.1.*0\.1\.0/,
  );
  assert.throws(
    () => plan({ manifest: { ...manifest(), private: true } }),
    /is private/,
  );
});

test("requires public npmjs publish configuration", () => {
  assert.throws(
    () => plan({ manifest: { ...manifest(), publishConfig: { access: "public" } } }),
    /must publish to https:\/\/registry\.npmjs\.org/,
  );
  assert.throws(
    () =>
      plan({
        manifest: {
          ...manifest(),
          publishConfig: { registry: "https://registry.npmjs.org/" },
        },
      }),
    /publishConfig\.access to public/,
  );
});

test("rejects a release commit outside refreshed origin/main", () => {
  assert.throws(
    () => plan({ reachableFromPrimary: false }),
    /not reachable from origin\/main/,
  );
});

test("derives named prerelease channels without using latest", () => {
  assert.equal(deriveNpmDistTag("1.0.0-beta.2"), "beta");
  assert.equal(deriveNpmDistTag("1.0.0-RC.1"), "rc");
  assert.throws(() => deriveNpmDistTag("1.0.0-1"), /named channel/);
  assert.throws(() => deriveNpmDistTag("1.0.0-latest.1"), /must not use the latest/);
});

test("observes published versions and fails closed for registry errors", async () => {
  const release = plan();
  assert.equal(
    await observeVersionPublication(release, {
      fetchImpl: async () => new Response(null, { status: 404 }),
    }),
    "absent",
  );
  assert.equal(
    await observeVersionPublication(release, {
      fetchImpl: async () => Response.json({ versions: { "0.1.0": {} } }),
    }),
    "absent",
  );
  assert.equal(
    await observeVersionPublication(release, {
      fetchImpl: async () => Response.json({ versions: { "0.1.1": {} } }),
    }),
    "published",
  );
  await assert.rejects(
    () =>
      observeVersionPublication(release, {
        fetchImpl: async () => new Response(null, { status: 503 }),
      }),
    /registry returned 503/,
  );
});

test("emits fixed GitHub outputs for later workflow steps", () => {
  assert.equal(
    formatGitHubOutput({ ...plan(), publicationState: "absent" }),
    [
      "release_key=silvermoon",
      "package_name=silvermoon",
      "package_directory=.",
      "version=0.1.1",
      "dist_tag=latest",
      "publication_state=absent",
    ].join("\n"),
  );
});
