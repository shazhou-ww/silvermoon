import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const packageRoot = fileURLToPath(new URL("../..", import.meta.url));
const configuredNpmCli = process.env.npm_execpath;
const npmCli = configuredNpmCli && /^npm-cli\.js$/i.test(basename(configuredNpmCli))
  ? configuredNpmCli
  : resolve(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");
const id = "01M36QGPNTXEPP61DA4KP4AVZF";

function ideaPaths(ideaId) {
  const idea = join(".silvermoon", "ideas", ideaId);
  return {
    root: idea,
    status: join(idea, "status.yaml"),
    ledger: join(idea, "ledger.md"),
    outer: join(idea, "outer"),
    deployment: join(idea, "outer", "Deployment.md"),
    inner: join(idea, "outer", "inner"),
    implementation: join(idea, "outer", "inner", "Implementation.md"),
    ideal: join(idea, "outer", "inner", "ideal"),
    idea: join(idea, "outer", "inner", "ideal", "Idea.md"),
  };
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    timeout: 120_000,
    windowsHide: true,
  });
  assert.equal(result.status, 0, `${command} ${args.join(" ")} failed:\n${result.stderr || result.error?.message}`);
  return result.stdout.trim();
}

function npm(args, cwd) {
  process.stdout.write(`SMOKE_NPM ${args[0]}\n`);
  const result = npmResult(args, cwd);
  assert.equal(
    result.status,
    0,
    `npm ${args.join(" ")} failed:\n${result.stderr || result.error?.message}`,
  );
  return result.stdout.trim();
}

function npmResult(args, cwd) {
  return spawnSync(process.execPath, [npmCli, ...args], {
    cwd,
    encoding: "utf8",
    timeout: 120_000,
    windowsHide: true,
  });
}

const temporaryRoot = await mkdtemp(join(tmpdir(), "silvermoon-pack-smoke-"));
try {
  const configuredTarball = process.env.SILVERMOON_TARBALL?.trim();
  let tarball;
  if (configuredTarball) {
    tarball = resolve(packageRoot, configuredTarball);
    assert.equal((await stat(tarball)).isFile(), true, tarball);
  } else {
    const packed = JSON.parse(
      npm(["pack", "--json", "--pack-destination", temporaryRoot], packageRoot),
    )[0];
    tarball = join(temporaryRoot, packed.filename);
  }
  const bootstrap = join(temporaryRoot, "bootstrap");
  await mkdir(bootstrap);
  run("git", ["init", "--initial-branch=main"], bootstrap);
  npm(["init", "-y"], bootstrap);
  npm(["install", "--ignore-scripts", "--no-audit", "--no-fund", tarball], bootstrap);
  const installedManifest = JSON.parse(
    await readFile(
      join(bootstrap, "node_modules", "silvermoon", "package.json"),
      "utf8",
    ),
  );
  assert.equal(installedManifest.name, "silvermoon");
  const bootstrapStatusBefore = run(
    "git",
    ["status", "--porcelain=v1", "--untracked-files=all"],
    bootstrap,
  );
  const bootstrapReport = JSON.parse(
    npm(["exec", "--", "silvermoon", "whats-next", "--json"], bootstrap),
  );
  const bootstrapStatusAfter = run(
    "git",
    ["status", "--porcelain=v1", "--untracked-files=all"],
    bootstrap,
  );
  assert.equal(bootstrapStatusAfter, bootstrapStatusBefore);
  assert.deepEqual(
    Object.keys(bootstrapReport).sort(),
    [
      "instructions",
      "intention",
      "observation",
      "outcomes",
    ],
  );
  assert.deepEqual(
    bootstrapReport.observation.problems.map(({ type }) => type),
    ["config-missing", "canonical-skill-missing"],
  );
  assert.equal(bootstrapReport.observation.observedThrough, "version");
  assert.match(bootstrapReport.instructions, /--agent universal/);
  assert.doesNotMatch(
    JSON.stringify(bootstrapReport),
    /package\.manifest|execution-source|project-local/,
  );

  const nonNode = join(temporaryRoot, "non-node");
  await mkdir(nonNode);
  run("git", ["init", "--initial-branch=main"], nonNode);
  const nonNodeReport = JSON.parse(run(
    process.execPath,
    [
      join(bootstrap, "node_modules", "silvermoon", "bin", "silvermoon.js"),
      "whats-next",
      "--json",
    ],
    nonNode,
  ));
  assert.deepEqual(
    nonNodeReport.observation.problems.map(({ type }) => type),
    ["config-missing", "canonical-skill-missing"],
  );
  await assert.rejects(readFile(join(nonNode, "package.json")), {
    code: "ENOENT",
  });

  const consumer = join(temporaryRoot, "consumer");
  const primary = join(temporaryRoot, "primary.git");
  const paths = ideaPaths(id);
  await mkdir(join(consumer, paths.ideal), { recursive: true });
  await writeFile(
    join(consumer, ".silvermoon", "config.yaml"),
    "version: 1\nprimaryRepository: https://example.com/owner/repository.git\nprimaryBranch: main\n",
  );
  await mkdir(join(consumer, ".silvermoon", "guidance"));
  await writeFile(
    join(consumer, ".silvermoon", "guidance", "preparing.md"),
    "Installed preparing guidance.\n",
  );
  await writeFile(join(consumer, ".gitignore"), "node_modules/\n");
  await writeFile(join(consumer, paths.idea), "# Installed package smoke\n");
  await writeFile(join(consumer, paths.implementation), "");
  await writeFile(join(consumer, paths.deployment), "");
  await writeFile(join(consumer, paths.ledger), "# Ledger\n");
  await writeFile(
    join(consumer, paths.status),
    `version: 1\nid: ${id}\nalias: installed-smoke\n`,
  );
  run("git", ["init", "--initial-branch=main"], consumer);
  run("git", ["config", "user.name", "silvermoon smoke"], consumer);
  run("git", ["config", "user.email", "silvermoon@example.invalid"], consumer);
  run("git", ["add", "."], consumer);
  run("git", ["commit", "-m", "Initialize smoke fixture"], consumer);

  npm(["install", "--ignore-scripts", "--no-audit", "--no-fund", tarball], consumer);
  const consumerManifestPath = join(consumer, "package.json");
  const consumerManifest = JSON.parse(await readFile(consumerManifestPath, "utf8"));
  delete consumerManifest.dependencies;
  consumerManifest.devDependencies = { silvermoon: installedManifest.version };
  await writeFile(consumerManifestPath, `${JSON.stringify(consumerManifest, null, 2)}\n`);
  npm([
    "exec",
    "--yes",
    "--package",
    "skills",
    "--",
    "skills",
    "add",
    "./node_modules/silvermoon/skills",
    "--skill",
    "silvermoon",
    "--agent",
    "universal",
    "--yes",
    "--copy",
  ], consumer);
  assert.match(
    await readFile(join(consumer, "node_modules", "silvermoon", "README.zh-CN.md"), "utf8"),
    /# Silvermoon（银月）/,
  );
  assert.match(
    await readFile(
      join(consumer, "node_modules", "silvermoon", "docs", "getting-started.md"),
      "utf8",
    ),
    /# Getting Started/,
  );
  const [canonicalAvatar, compatibilityAvatar] = await Promise.all([
    readFile(
      join(consumer, "node_modules", "silvermoon", "assets", "silvermoon-avatar.svg"),
    ),
    readFile(
      join(
        consumer,
        "node_modules",
        "silvermoon",
        "docs",
        "assets",
        "silvermoon-avatar.svg",
      ),
    ),
  ]);
  assert.deepEqual(compatibilityAvatar, canonicalAvatar);
  for (const schema of [
    "config.schema.json",
    "definitions.schema.json",
    "idea-status.schema.json",
  ]) {
    JSON.parse(
      await readFile(
        join(consumer, "node_modules", "silvermoon", "schema", "v1", schema),
        "utf8",
      ),
    );
  }
  await assert.rejects(
    readFile(join(consumer, "node_modules", ".bin", "repoledger"), "utf8"),
    { code: "ENOENT" },
  );
  run(
    "git",
    ["add", "package.json", "package-lock.json", ".gitignore", ".agents", "skills-lock.json"],
    consumer,
  );
  run("git", ["commit", "-m", "Install packed Silvermoon"], consumer);
  run("git", ["init", "--bare", "--initial-branch=main", primary], consumer);
  run(
    "git",
    ["config", `url.${pathToFileURL(primary).href}.insteadOf`, "https://example.com/owner/repository.git"],
    consumer,
  );
  run(
    "git",
    ["remote", "add", "origin", "https://example.com/owner/repository.git"],
    consumer,
  );
  run("git", ["push", "--set-upstream", "origin", "main"], consumer);
  const help = npm(["exec", "--", "silvermoon", "--help"], consumer);
  assert.match(help, /silvermoon whats-next/);
  assert.match(help, /silvermoon create-idea/);
  assert.match(help, /silvermoon check/);
  assert.doesNotMatch(
    help,
    /silvermoon whatsnext|silvermoon task|silvermoon status|silvermoon init|silvermoon skill/,
  );
  assert.equal(
    npm(["exec", "--", "silvermoon", "--version"], consumer),
    installedManifest.version,
  );
  const exported = run(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      "import * as silvermoon from 'silvermoon'; const names = ['checkRepository', 'createIdea', 'deriveIdeaState', 'generateUlid', 'parseIdeaStatus', 'whatsNext']; console.log(`${names.map((name) => typeof silvermoon[name]).join(',')}|${Object.hasOwn(silvermoon, 'implementationCriterionIds')},${Object.hasOwn(silvermoon, 'verifyCriteriaEvidence')}`);",
    ],
    consumer,
  );
  assert.equal(exported, "function,function,function,function,function,function|false,false");
  const localizedCheck = JSON.parse(
    npm(
      ["exec", "--", "silvermoon", "check", "--language", "ZH-cn", "--json"],
      consumer,
    ),
  );
  assert.equal(localizedCheck.intention.args.language, "zh-CN");
  assert.equal(localizedCheck.observation.outputLanguage, "zh-CN");
  assert.equal(
    localizedCheck.observation.configuration.preferredLanguage,
    "en-US",
  );
  const guidedLifecycle = JSON.parse(
    npm(
      ["exec", "--", "silvermoon", "whats-next", "installed-smoke", "--json"],
      consumer,
    ),
  );
  assert.deepEqual(guidedLifecycle.observation.guidance, {
    phase: "preparing",
    path: ".silvermoon/guidance/preparing.md",
    contentRevision: run(
      "git",
      ["rev-parse", "HEAD:.silvermoon/guidance/preparing.md"],
      consumer,
    ),
    content: "Installed preparing guidance.\n",
  });
  assert.doesNotMatch(
    guidedLifecycle.instructions,
    /Installed preparing guidance/,
  );
  const guidedLifecycleText = npm(
    ["exec", "--", "silvermoon", "whats-next", "installed-smoke"],
    consumer,
  );
  assert.match(guidedLifecycleText, /## Project phase guidance/);
  assert.match(guidedLifecycleText, /> Installed preparing guidance\./);
  const localizedCheckText = npm(
    ["exec", "--", "silvermoon", "check", "--language", "zh-CN"],
    consumer,
  );
  assert.match(localizedCheckText, /^## 检查\n\n- 目标: `head`/);
  assert.match(localizedCheckText, /- 结果: 通过/);
  const statusBeforeInvalidLanguage = run(
    "git",
    ["status", "--porcelain=v1", "--untracked-files=all"],
    consumer,
  );
  const invalidLanguage = npmResult(
    ["exec", "--", "silvermoon", "check", "--language", "fr-FR"],
    consumer,
  );
  assert.equal(invalidLanguage.status, 2, invalidLanguage.stderr);
  assert.match(invalidLanguage.stderr, /unsupported output language/);
  assert.equal(
    run("git", ["status", "--porcelain=v1", "--untracked-files=all"], consumer),
    statusBeforeInvalidLanguage,
  );
  const ideasBefore = await readdir(join(consumer, ".silvermoon", "ideas"));
  const created = JSON.parse(npm(["exec", "--", "silvermoon", "create-idea", "--json"], consumer));
  assert.deepEqual(Object.keys(created).sort(), [
    "instructions",
    "intention",
    "observation",
    "outcomes",
  ]);
  assert.equal(created.intention.command, "create-idea");
  assert.equal(created.observation.state, "idea-created");
  assert.deepEqual(
    created.observation.guidance,
    guidedLifecycle.observation.guidance,
  );
  assert.deepEqual(
    created.outcomes.map(({ type, status }) => [type, status]),
    [["create-idea-scaffold", "success"]],
  );
  const ideasAfter = await readdir(join(consumer, ".silvermoon", "ideas"));
  const createdId = ideasAfter.find((ideaId) => !ideasBefore.includes(ideaId));
  assert.match(createdId, /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/);
  const createdPaths = ideaPaths(createdId);
  assert.deepEqual(created.observation.createdIdea, {
    id: createdId,
    path: `.silvermoon/ideas/${createdId}`,
    state: "preparing",
  });
  assert.equal(Object.hasOwn(created.observation, "ideas"), false);
  assert.equal(
    await readFile(join(consumer, createdPaths.idea), "utf8"),
    `# Replace with a specific title for this idea

## Intent

<!-- State the desired outcome in one or two sentences. -->

## Context

<!-- Describe the current problem, situation, or opportunity. -->

## Desired outcome

<!-- Describe the externally meaningful state that should become true. -->

## Scope

### In scope

<!-- Describe what this idea includes. -->

### Out of scope

<!-- Describe adjacent work this idea intentionally excludes. -->

## Constraints

<!-- Record material product, repository, compatibility, or operational constraints. -->

## Open questions

<!-- Record unresolved decisions. Remove this section when none remain. -->
`,
  );
  assert.match(
    await readFile(join(consumer, createdPaths.ledger), "utf8"),
    /## Implementation[\s\S]*### Implementation steps[\s\S]*I-S01[\s\S]*### Implementation acceptance criteria[\s\S]*I-AC01[\s\S]*## Deployment[\s\S]*### Deployment steps[\s\S]*D-S01[\s\S]*### Deployment acceptance criteria[\s\S]*D-AC01/,
  );
  assert.equal(
    await readFile(join(consumer, createdPaths.status), "utf8"),
    `version: 1\nid: ${createdId}\n`,
  );
  const legacy = npmResult(["exec", "--", "silvermoon", "whatsnext"], consumer);
  assert.equal(legacy.status, 2, legacy.stderr);
  const checked = JSON.parse(npm(["exec", "--", "silvermoon", "check", "--json"], consumer));
  assert.deepEqual(Object.keys(checked).sort(), ["intention", "observation"]);
  assert.equal(checked.observation.state, "project-ready");
  assert.equal(checked.observation.ideas.activeIdeas[0].alias, "installed-smoke");
  const checkedText = npm(["exec", "--", "silvermoon", "check"], consumer);
  assert.match(checkedText, /^## Check\n\n- Target: `head`/);
  assert.match(checkedText, /- Result: valid/);
  assert.doesNotMatch(checkedText, /## Suggested next steps|## Actions and results/);
  const worktree = JSON.parse(
    npm(["exec", "--", "silvermoon", "check", "--worktree", "--json"], consumer),
  );
  const createdSummary = worktree.observation.ideas.activeIdeas.find(({ id: ideaId }) =>
    ideaId === createdId
  );
  assert.equal(worktree.observation.state, "project-ready");
  assert.equal(Object.hasOwn(createdSummary, "alias"), false);
  const lifecycle = JSON.parse(
    npm(
      [
        "exec",
        "--",
        "silvermoon",
        "whats-next",
        "installed-smoke",
        "--language",
        "zh-cn",
        "--json",
      ],
      consumer,
    ),
  );
  assert.equal(lifecycle.intention.args.language, "zh-CN");
  assert.equal(lifecycle.observation.outputLanguage, "zh-CN");
  assert.equal(
    lifecycle.observation.configuration.preferredLanguage,
    "en-US",
  );
  assert.equal(lifecycle.observation.state, "repository-sync-required");
  assert.equal(lifecycle.observation.problems[0].type, "worktree-changes");
  assert.match(lifecycle.observation.problems[0].summary, /未跟踪=5/);
  assert.deepEqual(lifecycle.outcomes, []);
  const lifecycleText = npm(
    ["exec", "--", "silvermoon", "whats-next", "installed-smoke"],
    consumer,
  );
  assert.match(lifecycleText, /^## Current instruction\n\n/);
  assert.match(lifecycleText, /\n\n### Ideas you can continue\n\n/);
  assert.match(lifecycleText, /\n\n### Issues to address\n\n- \[worktree-changes\]/);
  assert.doesNotMatch(lifecycleText, /## Actions and results/);
  await writeFile(
    join(consumer, ".agents", "skills", "silvermoon", "SKILL.md"),
    "drift\n",
  );
  const drift = JSON.parse(
    npm(["exec", "--", "silvermoon", "whats-next", "installed-smoke", "--json"], consumer),
  );
  assert.equal(
    drift.observation.state,
    "project-setup-required",
  );
  assert.equal(
    drift.observation.problems.find(({ type }) =>
      type === "canonical-skill-mismatched"
    ).type,
    "canonical-skill-mismatched",
  );
  process.stdout.write(
    `PACK_SMOKE_OK name=${installedManifest.name} version=${installedManifest.version} tarball=${tarball}\n`,
  );
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}