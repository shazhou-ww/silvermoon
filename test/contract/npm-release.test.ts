import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { parseDocument } from "yaml";

const releaseGuideUrl = new URL("../../docs/npm-package-releases.md", import.meta.url);
const workflowUrl = new URL("../../.github/workflows/publish-npm.yml", import.meta.url);
const publishSkillUrl = new URL("../../.agents/skills/publish/SKILL.md", import.meta.url);
const buildTarballUrl = new URL("../../bin/build-npm-tarball.ts", import.meta.url);
const checkPackUrl = new URL("../../bin/check-pack.ts", import.meta.url);
const npmTarballUrl = new URL("../../src/foundation/package-resource/npm-tarball.ts", import.meta.url);
const verifyReleaseUrl = new URL(
  "../../bin/verify-npm-release.ts",
  import.meta.url,
);
const installedPackageUrl = new URL(
  "../../test/e2e/installed-package.test.ts",
  import.meta.url,
);

test("uses a protected, least-privilege trusted-publishing workflow", async () => {
  const [
    source,
    buildTarball,
    checkPack,
    npmTarball,
    verifyRelease,
    installedPackage,
  ] = await Promise.all([
    readFile(workflowUrl, "utf8"),
    readFile(buildTarballUrl, "utf8"),
    readFile(checkPackUrl, "utf8"),
    readFile(npmTarballUrl, "utf8"),
    readFile(verifyReleaseUrl, "utf8"),
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

  const stepNames = publish.steps.map(({ name }: { name: string }) => name);
  const requiredChecks = [
    "Build repository",
    "Run unit tests",
    "Run contract tests",
    "Run integration tests",
    "Discover agent skills",
    "Validate local static checks",
    "Stage selected package",
    "Build selected package",
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
  assert.ok(
    stepNames.indexOf("Resolve release source tag") <
      stepNames.indexOf("Validate release instruction"),
    "the source tag must be resolved before release planning",
  );
  assert.ok(
    stepNames.indexOf("Verify 0.4.0 recovery ancestry") <
      stepNames.indexOf("Validate release instruction"),
    "recovery ancestry must be verified before release planning",
  );

  const generateReadmeIndex = stepNames.indexOf("Generate immutable npm README");
  const stageIndex = stepNames.indexOf("Stage selected package");
  const selectedBuildIndex = stepNames.indexOf("Build selected package");
  const buildIndex = stepNames.indexOf("Build selected package tarball");
  assert.ok(
    stageIndex > stepNames.indexOf("Discover agent skills"),
    "staging must run after release validation and layered tests",
  );
  assert.ok(
    stageIndex < selectedBuildIndex,
    "staging must run before building the selected package",
  );
  assert.ok(
    selectedBuildIndex < generateReadmeIndex,
    "the selected package must be built before README generation",
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

  const checkout = publish.steps.find(({ name }: { name: string }) => name === "Check out full history");
  const sourceTag = publish.steps.find(
    ({ name }: { name: string }) => name === "Resolve release source tag",
  );
  const setupPnpm = publish.steps.find(({ name }: { name: string }) => name === "Install pnpm");
  const setupNode = publish.steps.find(({ name }: { name: string }) => name === "Set up Node.js");
  const setupNpm = publish.steps.find(
    ({ name }: { name: string }) => name === "Install trusted-publishing npm",
  );
  const ancestry = publish.steps.find(
    ({ name }: { name: string }) => name === "Refresh primary branch and verify ancestry",
  );
  const recoveryAncestry = publish.steps.find(
    ({ name }: { name: string }) => name === "Verify 0.4.0 recovery ancestry",
  );
  const install = publish.steps.find(({ name }: { name: string }) => name === "Install frozen dependencies");
  const release = publish.steps.find(
    ({ name }: { name: string }) => name === "Validate release instruction",
  );
  const repositoryBuild = publish.steps.find(({ name }: { name: string }) => name === "Build repository");
  const unit = publish.steps.find(({ name }: { name: string }) => name === "Run unit tests");
  const contract = publish.steps.find(({ name }: { name: string }) => name === "Run contract tests");
  const integration = publish.steps.find(({ name }: { name: string }) => name === "Run integration tests");
  const skills = publish.steps.find(({ name }: { name: string }) => name === "Discover agent skills");
  const stage = publish.steps.find(({ name }: { name: string }) => name === "Stage selected package");
  const selectedBuild = publish.steps.find(
    ({ name }: { name: string }) => name === "Build selected package",
  );
  const generateReadme = publish.steps.find(
    ({ name }: { name: string }) => name === "Generate immutable npm README",
  );
  const build = publish.steps.find(
    ({ name }: { name: string }) => name === "Build selected package tarball",
  );
  const tarball = publish.steps.find(({ name }: { name: string }) => name === "Verify selected package tarball");
  const e2e = publish.steps.find(({ name }: { name: string }) => name === "Test installed package");
  const publication = publish.steps.find(({ name }: { name: string }) => name === "Publish selected package");
  const verification = publish.steps.find(
    ({ name }: { name: string }) => name === "Verify published package",
  );

  assert.equal(checkout.with["fetch-depth"], 0);
  assert.equal(
    checkout.uses,
    "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1",
  );
  assert.equal(sourceTag.id, "source");
  assert.equal(
    sourceTag.env.RELEASE_SOURCE_TAG,
    "${{ github.ref_name }}",
  );
  assert.match(
    sourceTag.run,
    /RELEASE_SOURCE_TAG" = "npm\/silvermoon-recovery\/v0\.4\.0"/,
  );
  assert.match(sourceTag.run, /PLANNER_TAG=npm\/silvermoon\/v0\.4\.0/);
  assert.match(sourceTag.run, /planner_tag=\$PLANNER_TAG/);
  assert.match(sourceTag.run, /recovery_state=\$RECOVERY_STATE/);
  assert.equal(
    setupPnpm.uses,
    "pnpm/action-setup@ea17c68df8912ef543352723c149a84f56e3d413",
  );
  assert.equal(
    setupNode.uses,
    "actions/setup-node@820762786026740c76f36085b0efc47a31fe5020",
  );
  assert.equal(setupNode.with["node-version"], 24);
  assert.equal(setupNode.with["registry-url"], "https://registry.npmjs.org");
  assert.equal(setupNode.with["package-manager-cache"], false);
  assert.match(setupNpm.run, /npm install --global npm@11\.6\.2/);
  assert.match(setupNpm.run, /npm --version/);
  assert.match(ancestry.run, /refs\/heads\/main:refs\/remotes\/origin\/main/);
  assert.match(
    ancestry.run,
    /git remote set-url origin "https:\/\/github\.com\/\$GITHUB_REPOSITORY\.git"/,
  );
  assert.match(ancestry.run, /git merge-base --is-ancestor/);
  assert.equal(
    recoveryAncestry.if,
    "steps.source.outputs.recovery_state == '0.4.0'",
  );
  assert.equal(
    recoveryAncestry.env.ORIGINAL_RELEASE_COMMIT,
    "9501f2f4887c360f0902f559e7c6456ffe72b43d",
  );
  assert.match(
    recoveryAncestry.run,
    /refs\/tags\/npm\/silvermoon\/v0\.4\.0:refs\/tags\/npm\/silvermoon\/v0\.4\.0/,
  );
  assert.match(
    recoveryAncestry.run,
    /git merge-base --is-ancestor "\$ORIGINAL_RELEASE_COMMIT" "\$GITHUB_SHA"/,
  );
  assert.equal(install.run, "pnpm install --frozen-lockfile");
  assert.equal(release.env.RELEASE_COMMIT, "${{ github.sha }}");
  assert.equal(
    release.env.RELEASE_TAG,
    "${{ steps.source.outputs.planner_tag }}",
  );
  assert.equal(repositoryBuild.run, "pnpm build");
  assert.equal(unit.run, "pnpm test:unit");
  assert.equal(contract.run, "pnpm test:contract");
  assert.equal(integration.run, "pnpm test:integration");
  assert.equal(skills.run, "pnpm check:skills");
  const staticChecks = publish.steps.find(({ name }: { name: string }) => name === "Validate local static checks");
  assert.equal(staticChecks.run, "pnpm lint:markdown\npnpm check:diff\nnode bin/silvermoon.ts check --commit HEAD --audience agent\n");
  for (const name of requiredChecks) {
    assert.equal(publish.steps.find((candidate: { name: string; }) => candidate.name === name).if, undefined, name);
  }
  assert.equal(stage.id, "stage");
  assert.equal(
    stage.env.PACKAGE_DIRECTORY,
    "${{ steps.release.outputs.package_directory }}",
  );
  assert.match(stage.run, /git archive "\$GITHUB_SHA" \| tar -x -C "\$STAGE_ROOT"/);
  assert.match(stage.run, /package_directory=\$PACKAGE_ROOT/);
  assert.match(stage.run, /artifact_directory=\$ARTIFACT_DIRECTORY/);
  assert.equal(
    selectedBuild["working-directory"],
    "${{ steps.stage.outputs.package_directory }}",
  );
  assert.equal(selectedBuild.run, "pnpm install --frozen-lockfile\npnpm build\n");
  assert.equal(
    generateReadme["working-directory"],
    "${{ steps.stage.outputs.package_directory }}",
  );
  assert.equal(generateReadme.env.RELEASE_COMMIT, "${{ github.sha }}");
  assert.match(
    generateReadme.run,
    /--commit "\$RELEASE_COMMIT" --source README\.md --out README\.md/,
  );
  assert.match(
    generateReadme.run,
    /--commit "\$RELEASE_COMMIT" --source README\.zh-CN\.md --out README\.zh-CN\.md/,
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
  assert.equal(build.env.RELEASE_COMMIT, "${{ github.sha }}");
  assert.match(build.run, /build-npm-tarball\.ts/);
  assert.match(build.run, /--package-directory "\$PACKAGE_DIRECTORY"/);
  assert.match(build.run, /--output-directory "\$ARTIFACT_DIRECTORY"/);
  assert.match(build.run, /--git-head "\$RELEASE_COMMIT"/);
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
  assert.equal(tarball.env.SILVERMOON_RELEASE_COMMIT, "${{ github.sha }}");
  assert.equal(
    publication.env.SILVERMOON_TARBALL_SHA256,
    "${{ steps.package.outputs.tarball_sha256 }}",
  );
  assert.equal(tarball.run, "npm run pack:check");
  assert.equal(e2e.run, "npm run test:e2e");
  assert.equal(
    publication.if,
    "steps.release.outputs.publication_state == 'absent'",
  );
  assert.match(publication.run, /sha256sum --check --strict/);
  assert.match(
    publication.run,
    /npm publish \. \\\n\s+--access public --provenance/,
  );
  assert.equal(
    publish.steps.filter(({ run = "" }) => run.includes("build-npm-tarball.ts")).length,
    1,
  );
  assert.equal(
    (buildTarball.match(/spawnImpl\(/g) ?? []).length,
    1,
  );
  assert.match(checkPack, /SILVERMOON_TARBALL/);
  assert.match(checkPack, /SILVERMOON_RELEASE_COMMIT/);
  assert.match(checkPack, /from "\.\.\/src\/foundation\/package-resource\/index\.ts"/);
  assert.doesNotMatch(checkPack, /from\s+["'][^"']*verify-npm-release\.ts/);
  assert.doesNotMatch(npmTarball, /from "(?!node:)/);
  assert.match(buildTarball, /readmeFilename/);
  assert.match(checkPack, /package README metadata does not match README\.md/);
  assert.match(checkPack, /does not match a deterministic directory pack/);
  assert.match(checkPack, /--dry-run/);
  assert.match(verifyRelease, /distTag === "latest"/);
  assert.match(installedPackage, /process\.env\.SILVERMOON_TARBALL/);
  assert.ok(
    stepNames.indexOf("Verify published package") >
      stepNames.indexOf("Publish selected package"),
  );
  assert.equal(
    verification.env.SILVERMOON_TARBALL,
    "${{ steps.package.outputs.tarball_path }}",
  );
  assert.equal(verification.env.RELEASE_TAG, "${{ github.ref_name }}");
  assert.match(verification.run, /verify-npm-release\.ts/);
  assert.match(verification.run, /--commit "\$RELEASE_COMMIT"/);
  assert.match(verification.run, /--tag "\$RELEASE_TAG"/);
  for (const required of [
    "dist-tags",
    "Candidate tarball gitHead mismatch",
    "Candidate tarball package README metadata",
    "npm dist identity",
    "assertPublicMetadata(candidate.manifest",
    "publicMetadata.license",
    "npm version metadata",
    "readmeFilename",
    "attestations",
    "jsDelivr asset",
    "Published npm tarball bytes do not match",
  ]) {
    assert.ok(
      verifyRelease.includes(required),
      `release verifier is missing: ${required}`,
    );
  }
  assert.equal(publish.steps.some(({ run }: { run: string }) => run === "pnpm check"), false);
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
    "git tag npm/silvermoon/v0.2.0-rc.1 origin/main",
    "RELEASE_PACKAGES",
    "Do not move or recreate the tag",
    "pnpm test:unit",
    "pnpm test:contract",
    "pnpm test:integration",
    "npm run test:e2e",
    "verify-npm-release.ts",
    "package-level README",
    "jsDelivr",
    "canonical `./assets/...` image paths",
    "release-commit-pinned jsDelivr URLs",
    "MIT license",
    "homepage",
    "bugs",
    "gh release create npm/silvermoon/v0.4.0",
    "npm/silvermoon-recovery/v0.4.0",
    "one-time recovery",
    "--verify-tag",
  ]) {
    assert.ok(guide.includes(required), `Release guide is missing: ${required}`);
  }
  assert.match(guide, /Do not\s+create an npm automation token/);
  assert.match(guide, /registry\s+integrity/);
  assert.match(guide, /new commit on `main`, choose a new version/);
});

test("provides an explicit project publish skill with immutable release safeguards", async () => {
  const source = await readFile(publishSkillUrl, "utf8");
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source);
  assert.ok(frontmatter, "publish skill is missing YAML frontmatter");
  const frontmatterSource = frontmatter[1];
  if (frontmatterSource === undefined) assert.fail("publish skill frontmatter is empty");
  const document = parseDocument(frontmatterSource);
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
    "bin/prepare-npm-release.ts",
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
    "VERIFY_NPM_RELEASE_OK",
    "package-level README",
    "registry integrity",
    "jsDelivr",
  ]) {
    assert.ok(source.includes(required), `publish skill is missing: ${required}`);
  }
  assert.match(source, /Never\r?\n\s+move, delete, or recreate a release tag/);
  assert.doesNotMatch(source, /NPM_TOKEN\s*=|NODE_AUTH_TOKEN\s*=/);
});
