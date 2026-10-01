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
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { npmCommand } from "../../scripts/npm-command.mjs";

const packageRoot = fileURLToPath(new URL("../..", import.meta.url));
const id = "01M36QGPNTXEPP61DA4KP4AVZF";

function responseText(report) {
  return report.response.nextSteps?.map(({ text }) => text).join("\n") ?? "";
}

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
  const invocation = npmCommand(args);
  return spawnSync(invocation.command, invocation.args, {
    cwd,
    encoding: "utf8",
    timeout: 600_000,
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
  const sourceObservation = spawnSync(process.execPath, [
    join(bootstrap, "node_modules", "silvermoon", "bin", "silvermoon.js"),
    "list-ideas", "--root", packageRoot, "--json",
  ], { cwd: bootstrap, encoding: "utf8", timeout: 120_000, windowsHide: true });
  assert.equal(sourceObservation.status, 1, sourceObservation.stderr);
  const sourceReport = JSON.parse(sourceObservation.stdout);
  assert.equal(sourceReport.observation.problems[0].type, "source-checkout-runtime-required");
  assert.equal(
    sourceReport.observation.problems.some(({ type }) => type.startsWith("npm-dependency-")),
    false,
  );
  assert.match(responseText(sourceReport), /node bin\/silvermoon\.js/);
  assert.equal(installedManifest.license, "MIT");
  assert.equal(
    installedManifest.homepage,
    "https://github.com/shazhou-ww/silvermoon#readme",
  );
  assert.deepEqual(installedManifest.bugs, {
    url: "https://github.com/shazhou-ww/silvermoon/issues",
  });
  assert.deepEqual(installedManifest.repository, {
    type: "git",
    url: "git+https://github.com/shazhou-ww/silvermoon.git",
  });
  const expectedMaintainer = {
    name: "shazhou-ww",
    url: "https://github.com/shazhou-ww",
  };
  assert.deepEqual(installedManifest.author, expectedMaintainer);
  assert.deepEqual(installedManifest.contributors, [expectedMaintainer]);
  assert.deepEqual(installedManifest.maintainers, [expectedMaintainer]);
  assert.match(
    await readFile(join(bootstrap, "node_modules", "silvermoon", "LICENSE"), "utf8"),
    /^MIT License\r?\n\r?\nCopyright \(c\) 2026 Silvermoon contributors\r?\n/,
  );
  for (const dependency of [
    "@opentui/core",
    "@opentui/react",
    "react",
    "tui-md",
  ]) {
    assert.equal(typeof installedManifest.dependencies[dependency], "string");
  }
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
      "actions",
      "intention",
      "observation",
      "response",
    ],
  );
  assert.deepEqual(
    bootstrapReport.observation.problems.map(({ type }) => type),
    [
      "config-missing",
      "npm-dependency-wrong-section",
      "canonical-skill-missing",
    ],
  );
  assert.equal(bootstrapReport.observation.observedThrough, "version");
  assert.match(responseText(bootstrapReport), /--agent universal/);
  assert.match(responseText(bootstrapReport), /npm install --save-dev/);
  assert.match(responseText(bootstrapReport), /\.\/node_modules\/silvermoon\/skills/);
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
  run("git", ["config", "core.autocrlf", "true"], consumer);
  run("git", ["add", "."], consumer);
  run("git", ["commit", "-m", "Initialize smoke fixture"], consumer);

  npm(["install", "--ignore-scripts", "--no-audit", "--no-fund", tarball], consumer);
  const consumerManifestPath = join(consumer, "package.json");
  const consumerManifest = JSON.parse(await readFile(consumerManifestPath, "utf8"));
  delete consumerManifest.dependencies;
  consumerManifest.devDependencies = { silvermoon: `^${installedManifest.version}` };
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
  await assert.rejects(
    stat(join(consumer, "node_modules", "silvermoon", "assets")),
    { code: "ENOENT" },
  );
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
  assert.match(help, /silvermoon list-ideas/);
  assert.match(help, /silvermoon whats-next/);
  assert.match(help, /silvermoon create-idea/);
  assert.match(help, /silvermoon check/);
  assert.match(help, /--audience agent/);
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
      "import * as silvermoon from 'silvermoon'; const names = ['CommandRun', 'checkRepository', 'createIdea', 'deriveIdeaState', 'driveCommand', 'generateUlid', 'listIdeas', 'normalizeIdeaQuery', 'parseIdeaStatus', 'queryIdeaInventory', 'renderResponse', 'respond', 'whatsNext']; console.log(`${names.map((name) => typeof silvermoon[name]).join(',')}|${silvermoon.DOMAIN_MESSAGE_SCHEMA_VERSION},${silvermoon.TRACE_SCHEMA_VERSION}|${Object.hasOwn(silvermoon, 'implementationCriterionIds')},${Object.hasOwn(silvermoon, 'verifyCriteriaEvidence')}`);",
    ],
    consumer,
  );
  assert.equal(
    exported,
    "function,function,function,function,function,function,function,function,function,function,function,function,function|1,2|false,false",
  );
  assert.equal(
    run(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        "import { renderTuiMarkdown } from './node_modules/silvermoon/src/tui.js'; console.log(typeof renderTuiMarkdown);",
      ],
      consumer,
    ),
    "function",
  );
  const inventory = JSON.parse(
    npm(
      ["exec", "--", "silvermoon", "list-ideas", "--all", "--json"],
      consumer,
    ),
  );
  assert.deepEqual(Object.keys(inventory), [
    "intention",
    "observation",
    "actions",
    "response",
  ]);
  assert.equal(inventory.observation.state, "ideas-listed");
  assert.deepEqual(inventory.actions, []);
  assert.equal(inventory.response.kind, "idea-list");
  assert.deepEqual(inventory.response.items, inventory.observation.ideas);
  assert.equal(inventory.observation.ideas[0].alias, "installed-smoke");
  assert.equal(inventory.observation.ideas[0].title, "Installed package smoke");
  const localizedInventory = JSON.parse(
    npm(
      [
        "exec",
        "--",
        "silvermoon",
        "list-ideas",
        "--language",
        "ZH",
        "--json",
      ],
      consumer,
    ),
  );
  assert.equal(localizedInventory.intention.args.language, "zh-CN");
  assert.equal(localizedInventory.observation.outputLanguage, "zh-CN");
  assert.equal(localizedInventory.response.language, "zh-CN");
  assert.equal(
    localizedInventory.observation.configuration.preferredLanguage,
    "en-US",
  );
  const inventoryText = npm(
    [
      "exec",
      "--",
      "silvermoon",
      "list-ideas",
      "--state",
      "active",
      "--audience",
      "agent",
    ],
    consumer,
  );
  assert.match(inventoryText, /^## Ideas/);
  assert.match(inventoryText, /installed-smoke/);
  assert.doesNotMatch(inventoryText, /Next steps/);
  const localizedInventoryText = npm(
    [
      "exec",
      "--",
      "silvermoon",
      "list-ideas",
      "--language",
      "zh-CN",
      "--audience",
      "agent",
    ],
    consumer,
  );
  assert.match(localizedInventoryText, /匹配 \d+ 个 idea，返回 \d+ 个。/);
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
  const publicGuidance = {
    phase: "preparing",
    path: ".silvermoon/guidance/preparing.md",
    contentRevision: run(
      "git",
      ["rev-parse", "HEAD:.silvermoon/guidance/preparing.md"],
      consumer,
    ),
  };
  assert.deepEqual(guidedLifecycle.observation.guidance, publicGuidance);
  assert.deepEqual(guidedLifecycle.response.guidance, {
    ...publicGuidance,
    content: "Installed preparing guidance.\n",
  });
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
  assert.match(
    localizedCheckText,
    /^## 检查\n\n请求的 Silvermoon snapshot 验证通过。\n\n- 目标: `head`/,
  );
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
  const conflictingOutput = npmResult(
    ["exec", "--", "silvermoon", "check", "--json", "--audience", "agent"],
    consumer,
  );
  assert.equal(conflictingOutput.status, 2, conflictingOutput.stderr);
  assert.match(conflictingOutput.stderr, /cannot be used with option '--json'/);
  assert.equal(
    run("git", ["status", "--porcelain=v1", "--untracked-files=all"], consumer),
    statusBeforeInvalidLanguage,
  );
  const ideasBefore = await readdir(join(consumer, ".silvermoon", "ideas"));
  const created = JSON.parse(npm(["exec", "--", "silvermoon", "create-idea", "--json"], consumer));
  assert.deepEqual(Object.keys(created).sort(), [
    "actions",
    "intention",
    "observation",
    "response",
  ]);
  assert.equal(created.intention.command, "create-idea");
  assert.equal(created.observation.state, "idea-created");
  assert.deepEqual(
    created.observation.guidance,
    guidedLifecycle.observation.guidance,
  );
  assert.deepEqual(
    created.actions.map(({ type, status }) => [type, status]),
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
  assert.deepEqual(Object.keys(checked).sort(), [
    "actions",
    "intention",
    "observation",
    "response",
  ]);
  assert.equal(checked.observation.state, "project-ready");
  assert.equal(checked.observation.ideas.activeIdeas[0].alias, "installed-smoke");
  const checkedText = npm(["exec", "--", "silvermoon", "check"], consumer);
  assert.match(
    checkedText,
    /^## Check\n\nThe requested Silvermoon snapshot is valid\.\n\n- Target: `head`/,
  );
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
  assert.deepEqual(lifecycle.actions, []);
  const lifecycleText = npm(
    ["exec", "--", "silvermoon", "whats-next", "installed-smoke"],
    consumer,
  );
  assert.match(
    lifecycleText,
    /^## Blocked\n\nThe repository must be synchronized before this command can continue\./,
  );
  assert.match(
    lifecycleText,
    /\n\n### Issues to address\n\n\| Type \| Summary \|\n\| --- \| --- \|\n\| worktree-changes \|/,
  );
  assert.doesNotMatch(lifecycleText, /### Ideas you can continue/);
  assert.doesNotMatch(lifecycleText, /## Actions and results/);
  const eventConsumer = join(temporaryRoot, "event-consumer");
  run("git", ["-c", "core.autocrlf=false", "clone", primary, eventConsumer], temporaryRoot);
  run("git", ["config", "user.name", "event smoke"], eventConsumer);
  run("git", ["config", "user.email", "events@example.invalid"], eventConsumer);
  run("git", ["config", "core.autocrlf", "false"], eventConsumer);
  run("git", ["remote", "set-url", "origin", "https://example.com/owner/repository.git"], eventConsumer);
  run("git", ["config", `url.${pathToFileURL(primary).href}.insteadOf`, "https://example.com/owner/repository.git"], eventConsumer);
  const installedRoot = join(bootstrap, "node_modules", "silvermoon");
  const migrationEntrypoint = join(installedRoot, "bin", "migrate-v1-to-v2.js");
  const eventEntrypoint = join(installedRoot, "bin", "silvermoon.js");
  const migrationPlan = JSON.parse(run(process.execPath, [migrationEntrypoint, "--root", eventConsumer], bootstrap));
  assert.equal(migrationPlan.outcome, "migration-planned");
  const migrated = JSON.parse(run(process.execPath, [migrationEntrypoint, "--root", eventConsumer,
    "--apply", "--expected-digest", migrationPlan.digest], bootstrap));
  assert.equal(migrated.outcome, "migrated");
  const migrationCheck = JSON.parse(run(process.execPath, [eventEntrypoint, "check",
    "--root", eventConsumer, "--worktree", "--json"], bootstrap));
  assert.equal(migrationCheck.observation.state, "project-ready");
  run("git", ["add", "."], eventConsumer);
  run("git", ["commit", "-m", "Migrate installed event fixture"], eventConsumer);
  run("git", ["push", "origin", "HEAD:main"], eventConsumer);
  const observedEvents = JSON.parse(run(process.execPath, [eventEntrypoint, "event", "replay",
    id, "--root", eventConsumer, "--json"], bootstrap)).observation.receipt;
  const requestFile = join(temporaryRoot, "event-request.json");
  await writeFile(requestFile, JSON.stringify({ type: "setAlias", payload: { alias: "installed-events" } }));
  const appended = JSON.parse(run(process.execPath, [eventEntrypoint, "event", "append", id,
    "--root", eventConsumer, "--input", requestFile,
    "--expected-length", String(observedEvents.length), "--expected-digest", observedEvents.digest,
    "--expected-primary", observedEvents.baseline.commit, "--json"], bootstrap));
  assert.equal(appended.observation.receipt.outcome, "candidate-written");
  assert.equal((await readFile(join(eventConsumer, paths.root, "events.jsonl"), "utf8")).includes("installed-events"), true);
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