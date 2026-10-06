import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { URL } from "node:url";

import { parseDocument } from "yaml";

const repositoryRoot = new URL("../../", import.meta.url);
const workflowsUrl = new URL(".github/workflows/", repositoryRoot);

async function read(path: string|URL) {
  return readFile(new URL(path, repositoryRoot), "utf8");
}

test("develops Silvermoon with the source CLI and no published self-dependency", async () => {
  const manifest = JSON.parse(await read("package.json"));
  assert.equal(manifest.scripts.silvermoon, "node bin/silvermoon.js");
  assert.equal(manifest.scripts.typecheck, "tsc -p tsconfig.json");
  assert.equal(
    manifest.scripts.build,
    "npm run clean && tsc -p tsconfig.build.json && node tools/write-cli-shim.ts",
  );
  assert.equal(manifest.types, "./dist/src/index.d.ts");
  assert.deepEqual(manifest.bin, { silvermoon: "dist/bin/silvermoon.js" });
  assert.deepEqual(manifest.exports, {
    ".": {
      types: "./dist/src/index.d.ts",
      default: "./dist/src/index.js",
    },
    "./agents/copilot": {
      types: "./dist/src/business/agent-copilot.d.ts",
      default: "./dist/src/business/agent-copilot.js",
    },
    "./agents/project-runtime": {
      types: "./dist/src/business/agent-project-runtime.d.ts",
      default: "./dist/src/business/agent-project-runtime.js",
    },
  });
  assert.ok(manifest.files.includes("dist"));
  assert.equal(manifest.files.includes("src"), false);
  assert.equal(manifest.files.includes("bin"), false);
  for (const section of [
    "dependencies", "devDependencies", "peerDependencies", "optionalDependencies",
  ]) {
    assert.equal(Object.hasOwn(manifest[section] ?? {}, "silvermoon"), false, section);
  }
  const lock = parseDocument(await read("pnpm-lock.yaml")).toJS();
  for (const section of ["dependencies", "devDependencies", "optionalDependencies"]) {
    assert.equal(Object.hasOwn(lock.importers["."][section] ?? {}, "silvermoon"), false);
  }
  assert.equal(Object.keys(lock.packages).some((name) => name.startsWith("silvermoon@")), false);
});

test("configures reviewable dependency updates for npm and GitHub Actions", async () => {
  const document = parseDocument(await read(".github/dependabot.yml"));
  assert.deepEqual(document.errors, []);
  const config = document.toJS();
  assert.equal(config.version, 2);
  assert.deepEqual(
    config.updates.map((update: { [x: string]: unknown; }) => update["package-ecosystem"]).sort(),
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
    (update: { [x: string]: string; }) => update["package-ecosystem"] === "npm",
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

  assert.equal(manifest.version, "0.3.0");
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

test("prepares complete stable 0.3.0 changelog and GitHub Release materials", async () => {
  const [changelog, stableReleaseNotes, rc2ReleaseNotes, rc1ReleaseNotes] =
    await Promise.all([
      read("CHANGELOG.md"),
      read(".github/release-notes/0.3.0.md"),
      read(".github/release-notes/0.3.0-rc.2.md"),
      read(".github/release-notes/0.3.0-rc.1.md"),
    ]);

  assert.match(changelog, /## \[0\.3\.0\]/);
  assert.match(changelog, /## \[0\.3\.0-rc\.2\]/);
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
    "Silvermoon 0.3.0",
    "silvermoon@0.3.0",
    "npm dist-tag: `latest`",
    "npm/silvermoon/v0.3.0",
    "npm/silvermoon/v0.2.2...npm/silvermoon/v0.3.0",
    "GitHub release type: stable",
    "License: MIT",
    "Node.js 22",
    "experimental before `1.0.0`",
    "provenance",
  ]) {
    assert.ok(
      stableReleaseNotes.includes(required),
      `Release notes are missing: ${required}`,
    );
  }
  assert.match(rc1ReleaseNotes, /^# Silvermoon 0\.3\.0-rc\.1$/m);
  assert.match(rc2ReleaseNotes, /^# Silvermoon 0\.3\.0-rc\.2$/m);
});
