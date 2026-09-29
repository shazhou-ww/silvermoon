import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { parseDocument } from "yaml";

const releaseGuideUrl = new URL("../../docs/npm-package-releases.md", import.meta.url);
const workflowUrl = new URL("../../.github/workflows/publish-npm.yml", import.meta.url);
const publishSkillUrl = new URL("../../.agents/skills/publish/SKILL.md", import.meta.url);
const buildTarballUrl = new URL("../../scripts/build-npm-tarball.mjs", import.meta.url);
const checkPackUrl = new URL("../../scripts/check-pack.js", import.meta.url);
const installedPackageUrl = new URL(
  "../../test/e2e/installed-package.test.js",
  import.meta.url,
);

test("uses a protected, least-privilege trusted-publishing workflow", async () => {
  const [source, buildTarball, checkPack, installedPackage] = await Promise.all([
    readFile(workflowUrl, "utf8"),
    readFile(buildTarballUrl, "utf8"),
    readFile(checkPackUrl, "utf8"),
    readFile(installedPackageUrl, "utf8"),
  ]);
  const document = parseDocument(source);
  assert.deepEqual(document.errors, []);

  const workflow = document.toJS();
  assert.deepEqual(workflow.on.push.tags, ["npm/**"]);
  assert.deepEqual(workflow.permissions, {});

  const publish = workflow.jobs.publish;
  assert.equal(publish["runs-on"], "ubuntu-latest");
  assert.equal(publish.environment, "npm");
  assert.deepEqual(publish.permissions, {
    contents: "read",
    "id-token": "write",
  });
  assert.deepEqual(workflow.concurrency, {
    group: "npm-publish",
    "cancel-in-progress": false,
  });

  const stepNames = publish.steps.map(({ name }) => name);
  const requiredChecks = [
    "Validate CLI syntax",
    "Run unit tests",
    "Run contract tests",
    "Run integration tests",
    "Discover agent skills",
    "Stage selected package",
    "Generate immutable npm README",
    "Build selected package tarball",
    "Verify selected package tarball",
    "Test installed package",
  ];
  for (const name of requiredChecks) {
    assert.ok(
      stepNames.indexOf(name) > stepNames.indexOf("Validate release instruction"),
      `${name} must run after release validation`,
    );
    assert.ok(
      stepNames.indexOf(name) < stepNames.indexOf("Publish selected package"),
      `${name} must run before publication`,
    );
  }

  const generateReadmeIndex = stepNames.indexOf("Generate immutable npm README");
  const stageIndex = stepNames.indexOf("Stage selected package");
  const buildIndex = stepNames.indexOf("Build selected package tarball");
  assert.ok(
    stageIndex > stepNames.indexOf("Discover agent skills"),
    "staging must run after release validation and layered tests",
  );
  assert.ok(
    stageIndex < generateReadmeIndex,
    "staging must run before README generation",
  );
  assert.ok(
    generateReadmeIndex < buildIndex,
    "README generation must run before the one tarball build",
  );
  for (const name of [
    "Verify selected package tarball",
    "Test installed package",
    "Publish selected package",
  ]) {
    assert.ok(
      buildIndex < stepNames.indexOf(name),
      `the tarball build must run before ${name}`,
    );
  }

  const checkout = publish.steps.find(({ name }) => name === "Check out full history");
  const setupNode = publish.steps.find(({ name }) => name === "Set up Node.js");
  const setupNpm = publish.steps.find(
    ({ name }) => name === "Install trusted-publishing npm",
  );
  const ancestry = publish.steps.find(
    ({ name }) => name === "Refresh primary branch and verify ancestry",
  );
  const install = publish.steps.find(({ name }) => name === "Install frozen dependencies");
  const syntax = publish.steps.find(({ name }) => name === "Validate CLI syntax");
  const unit = publish.steps.find(({ name }) => name === "Run unit tests");
  const contract = publish.steps.find(({ name }) => name === "Run contract tests");
  const integration = publish.steps.find(({ name }) => name === "Run integration tests");
  const skills = publish.steps.find(({ name }) => name === "Discover agent skills");
  const stage = publish.steps.find(({ name }) => name === "Stage selected package");
  const generateReadme = publish.steps.find(
    ({ name }) => name === "Generate immutable npm README",
  );
  const build = publish.steps.find(
    ({ name }) => name === "Build selected package tarball",
  );
  const tarball = publish.steps.find(({ name }) => name === "Verify selected package tarball");
  const e2e = publish.steps.find(({ name }) => name === "Test installed package");
  const publication = publish.steps.find(({ name }) => name === "Publish selected package");

  assert.equal(checkout.with["fetch-depth"], 0);
  assert.equal(checkout.uses, "actions/checkout@v6");
  assert.equal(setupNode.uses, "actions/setup-node@v6");
  assert.equal(setupNode.with["node-version"], 24);
  assert.equal(setupNode.with["registry-url"], "https://registry.npmjs.org");
  assert.equal(setupNode.with["package-manager-cache"], false);
  assert.match(setupNpm.run, /npm install --global npm@11\.6\.2/);
  assert.match(setupNpm.run, /npm --version/);
  assert.match(ancestry.run, /refs\/heads\/main:refs\/remotes\/origin\/main/);
  assert.match(ancestry.run, /git merge-base --is-ancestor/);
  assert.equal(install.run, "pnpm install --frozen-lockfile");
  assert.equal(syntax.run, "node --check bin/silvermoon.js");
  assert.equal(unit.run, "pnpm test:unit");
  assert.equal(contract.run, "pnpm test:contract");
  assert.equal(integration.run, "pnpm test:integration");
  assert.equal(skills.run, "pnpm check:skills");
  assert.equal(stage.id, "stage");
  assert.equal(
    stage.env.PACKAGE_DIRECTORY,
    "${{ steps.release.outputs.package_directory }}",
  );
  assert.match(stage.run, /git archive "\$GITHUB_SHA" \| tar -x -C "\$STAGE_ROOT"/);
  assert.match(stage.run, /package_directory=\$PACKAGE_ROOT/);
  assert.match(stage.run, /artifact_directory=\$ARTIFACT_DIRECTORY/);
  assert.equal(
    generateReadme["working-directory"],
    "${{ steps.stage.outputs.package_directory }}",
  );
  assert.equal(generateReadme.env.RELEASE_COMMIT, "${{ github.sha }}");
  assert.match(
    generateReadme.run,
    /generate-npm-readme\.mjs[\s\S]*--commit "\$RELEASE_COMMIT" --out README\.md/,
  );
  assert.doesNotMatch(
    generateReadme.run,
    />\s*README\.md/,
    "README generation must use --out, never a shell redirect that truncates the source",
  );
  assert.equal(build.id, "package");
  assert.equal(
    build.env.PACKAGE_DIRECTORY,
    "${{ steps.stage.outputs.package_directory }}",
  );
  assert.equal(
    build.env.ARTIFACT_DIRECTORY,
    "${{ steps.stage.outputs.artifact_directory }}",
  );
  assert.match(build.run, /build-npm-tarball\.mjs/);
  assert.match(build.run, /--package-directory "\$PACKAGE_DIRECTORY"/);
  assert.match(build.run, /--output-directory "\$ARTIFACT_DIRECTORY"/);
  for (const step of [generateReadme, tarball, e2e, publication]) {
    assert.equal(
      step["working-directory"],
      "${{ steps.stage.outputs.package_directory }}",
    );
  }
  for (const step of [tarball, e2e, publication]) {
    assert.equal(
      step.env.SILVERMOON_TARBALL,
      "${{ steps.package.outputs.tarball_path }}",
    );
  }
  assert.equal(
    tarball.env.SILVERMOON_TARBALL_SHA256,
    "${{ steps.package.outputs.tarball_sha256 }}",
  );
  assert.equal(
    tarball.env.SILVERMOON_TARBALL_INTEGRITY,
    "${{ steps.package.outputs.tarball_integrity }}",
  );
  assert.equal(
    publication.env.SILVERMOON_TARBALL_SHA256,
    "${{ steps.package.outputs.tarball_sha256 }}",
  );
  assert.equal(tarball.run, "npm run pack:check");
  assert.equal(e2e.run, "npm run test:e2e");
  assert.match(publication.run, /sha256sum --check --strict/);
  assert.match(
    publication.run,
    /npm publish "\$SILVERMOON_TARBALL" \\\n\s+--access public --provenance/,
  );
  assert.equal(
    publish.steps.filter(({ run = "" }) => run.includes("build-npm-tarball.mjs")).length,
    1,
  );
  assert.equal(
    (buildTarball.match(/spawnImpl\(/g) ?? []).length,
    1,
  );
  assert.match(checkPack, /SILVERMOON_TARBALL/);
  assert.match(checkPack, /--dry-run/);
  assert.match(installedPackage, /process\.env\.SILVERMOON_TARBALL/);
  assert.equal(publish.steps.some(({ run }) => run === "pnpm check"), false);
  assert.doesNotMatch(source, /NODE_AUTH_TOKEN|NPM_TOKEN/);
});

test("documents trusted-publisher setup and the protected release procedure", async () => {
  const guide = await readFile(releaseGuideUrl, "utf8");
  for (const required of [
    "Organization or user: `shazhou-ww`",
    "Repository: `silvermoon`",
    "Workflow filename: `publish-npm.yml`",
    "Environment: `npm`",
    "Allowed action: direct `npm publish`",
    "tag ruleset targeting `npm/**`",
    "git tag npm/silvermoon/v0.1.1 origin/main",
    "RELEASE_PACKAGES",
    "Do not move or recreate the tag",
    "pnpm test:unit",
    "pnpm test:contract",
    "pnpm test:integration",
    "npm run test:e2e",
  ]) {
    assert.ok(guide.includes(required), `Release guide is missing: ${required}`);
  }
  assert.match(guide, /Do not\s+create an npm automation token/);
  assert.match(guide, /new commit on `main`, choose a new version/);
});

test("provides an explicit project publish skill with immutable release safeguards", async () => {
  const source = await readFile(publishSkillUrl, "utf8");
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source);
  assert.ok(frontmatter, "publish skill is missing YAML frontmatter");
  const document = parseDocument(frontmatter[1]);
  assert.deepEqual(document.errors, []);
  assert.deepEqual(document.toJS(), {
    name: "publish",
    description:
      "Publish the allowlisted npm package from this repository through the protected GitHub Actions trusted-publishing workflow. Use only when the user explicitly invokes /publish with a release key and version intent.",
    "argument-hint": "[silvermoon] [major|minor|patch|x.y.z]",
    "user-invocable": true,
    "disable-model-invocation": true,
  });
  for (const required of [
    "docs/npm-package-releases.md",
    "scripts/prepare-npm-release.mjs",
    ".github/workflows/publish-npm.yml",
    "Never run",
    "npm publish",
    "pnpm install --frozen-lockfile",
    "pnpm check",
    "git tag npm/<release-key>/v<version> origin/main",
    "Silvermoon phase handoff",
    "implementationAcceptedRevision",
    "require `deploy-idea` before creating the release",
    "Require the workflow conclusion to be `success`",
  ]) {
    assert.ok(source.includes(required), `publish skill is missing: ${required}`);
  }
  assert.match(source, /Never\r?\n\s+move, delete, or recreate a release tag/);
  assert.doesNotMatch(source, /NPM_TOKEN\s*=|NODE_AUTH_TOKEN\s*=/);
});
