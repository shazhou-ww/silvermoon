import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

import { parseDocument } from "yaml";

const repositoryRoot = new URL("../../", import.meta.url);
const workflowsUrl = new URL(".github/workflows/", repositoryRoot);

async function read(path) {
  return readFile(new URL(path, repositoryRoot), "utf8");
}

test("configures reviewable dependency updates for npm and GitHub Actions", async () => {
  const document = parseDocument(await read(".github/dependabot.yml"));
  assert.deepEqual(document.errors, []);
  const config = document.toJS();
  assert.equal(config.version, 2);
  assert.deepEqual(
    config.updates.map((update) => update["package-ecosystem"]).sort(),
    ["github-actions", "npm"],
  );

  for (const update of config.updates) {
    assert.equal(update.directory, "/");
    assert.deepEqual(update.schedule, {
      interval: "weekly",
      day: "monday",
      time: "09:00",
      timezone: "Etc/UTC",
    });
    assert.equal(update["open-pull-requests-limit"], 5);
  }

  const npm = config.updates.find(
    (update) => update["package-ecosystem"] === "npm",
  );
  assert.equal(npm["versioning-strategy"], "increase-if-necessary");
  assert.deepEqual(npm.groups, {
    "production-dependencies": {
      "dependency-type": "production",
      "update-types": ["minor", "patch"],
    },
    "development-dependencies": { "dependency-type": "development" },
  });
});

test("defines the exact active main ruleset contract", async () => {
  const ruleset = JSON.parse(await read(".github/rulesets/main.json"));
  assert.deepEqual(ruleset, {
    name: "Protect main",
    target: "branch",
    enforcement: "active",
    bypass_actors: [{
      actor_id: 242885595,
      actor_type: "User",
      bypass_mode: "always",
    }],
    conditions: {
      ref_name: {
        include: ["refs/heads/main"],
        exclude: [],
      },
    },
    rules: [
      { type: "deletion" },
      { type: "non_fast_forward" },
      {
        type: "required_status_checks",
        parameters: {
          do_not_enforce_on_create: false,
          required_status_checks: [{
            context: "Required checks",
            integration_id: 15368,
          }],
          strict_required_status_checks_policy: true,
        },
      },
    ],
  });
});

test("uses only approved external workflow actions pinned to immutable SHAs", async () => {
  const workflowNames = (await readdir(workflowsUrl))
    .filter((name) => /\.ya?ml$/.test(name))
    .sort();
  assert.deepEqual(workflowNames, ["ci.yml", "publish-npm.yml"]);

  const actionIdentities = [];
  for (const name of workflowNames) {
    const source = await readFile(new URL(name, workflowsUrl), "utf8");
    const usesLines = source.match(/^\s*uses:\s*.+$/gm) ?? [];
    assert.ok(usesLines.length > 0, `${name} has no action references`);
    for (const line of usesLines) {
      const match =
        /^\s*uses:\s*([^@\s]+)@([0-9a-f]{40})\s+#\s+(v\d+\.\d+\.\d+)\s*$/
          .exec(line);
      assert.ok(match, `${name} has a movable or unversioned action: ${line}`);
      actionIdentities.push(match[1]);
    }
  }

  assert.deepEqual(new Set(actionIdentities), new Set([
    "actions/checkout",
    "actions/setup-node",
    "pnpm/action-setup",
  ]));
});

test("publishes explicit metadata and a pre-1.0 experimental API contract", async () => {
  const [manifestSource, reference] = await Promise.all([
    read("package.json"),
    read("docs/reference.md"),
  ]);
  const manifest = JSON.parse(manifestSource);
  const maintainer = {
    name: "shazhou-ww",
    url: "https://github.com/shazhou-ww",
  };

  assert.equal(manifest.version, "0.3.0-rc.1");
  assert.equal(manifest.license, "MIT");
  assert.equal(
    manifest.homepage,
    "https://github.com/shazhou-ww/silvermoon#readme",
  );
  assert.deepEqual(manifest.bugs, {
    url: "https://github.com/shazhou-ww/silvermoon/issues",
  });
  assert.deepEqual(manifest.author, maintainer);
  assert.deepEqual(manifest.contributors, [maintainer]);
  assert.deepEqual(manifest.maintainers, [maintainer]);

  assert.match(reference, /## Experimental JavaScript Package API/);
  assert.match(reference, /does not yet promise stable\s+TypeScript declarations/);
});

test("prepares complete 0.3.0-rc.1 changelog and GitHub prerelease materials", async () => {
  const [changelog, releaseNotes, stableReleaseNotes] = await Promise.all([
    read("CHANGELOG.md"),
    read(".github/release-notes/0.3.0-rc.1.md"),
    read(".github/release-notes/0.3.0.md"),
  ]);

  assert.match(changelog, /## \[0\.3\.0-rc\.1\]/);
  assert.doesNotMatch(changelog, /## Unreleased/);
  for (const required of [
    "Audience-aware CLI output",
    "MIT licensing",
    "Dependabot",
    "experimental before",
    "Required checks",
    "provenance",
  ]) {
    assert.ok(changelog.includes(required), `Changelog is missing: ${required}`);
  }
  for (const required of [
    "Silvermoon 0.3.0-rc.1",
    "release candidate",
    "silvermoon@0.3.0-rc.1",
    "npm dist-tag: `rc`",
    "npm/silvermoon/v0.3.0-rc.1",
    "npm/silvermoon/v0.2.2...npm/silvermoon/v0.3.0-rc.1",
    "latest",
    "License: MIT",
    "Node.js 22",
    "experimental before `1.0.0`",
    "provenance",
  ]) {
    assert.ok(
      releaseNotes.includes(required),
      `Release notes are missing: ${required}`,
    );
  }
  assert.match(stableReleaseNotes, /^# Silvermoon 0\.3\.0$/m);
  assert.match(stableReleaseNotes, /npm\/silvermoon\/v0\.3\.0/);
});
