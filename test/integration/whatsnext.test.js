import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, test } from "node:test";
import { pathToFileURL } from "node:url";

import { observeGitCommands } from "../../src/git.js";
import { inspectPhaseGuidance } from "../../src/guidance.js";
import {
  GUIDANCE_ROOT,
  phaseGuidancePath,
} from "../../src/layout.js";
import {
  CHANGE_SAMPLE_ITEM_LIMIT,
  whatsNext,
} from "../../src/whatsnext.js";
import {
  createRepository,
  FIRST_ID,
  git,
  PRIMARY_REPOSITORY,
  SECOND_ID,
  setIdeaState,
} from "../helpers/repository.js";

const temporaryDirectories = [];
const DEPLOYING_ID = "01M36QGPNTXEPP61DA4KP4AVG1";
const COMPLETED_ID = "01M36QGPNTXEPP61DA4KP4AVG2";
const ABANDONED_ID = "01M36QGPNTXEPP61DA4KP4AVG3";

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true })
    ),
  );
});

async function fixture(options) {
  const repository = await createRepository(options);
  temporaryDirectories.push(repository.base);
  return repository;
}

function envelopeKeys(report) {
  return Object.keys(report).sort();
}

function responseText(report) {
  return report.response.nextSteps?.map(({ text }) => text).join("\n") ?? "";
}

async function pushPeerChange(repository, name) {
  const peer = join(repository.base, `peer-${name}`);
  const cloned = spawnSync("git", ["clone", repository.remote, peer], {
    encoding: "utf8",
    windowsHide: true,
  });
  assert.equal(cloned.status, 0, cloned.stderr);
  git(peer, "config", "user.name", "silvermoon peer");
  git(peer, "config", "user.email", "silvermoon@example.invalid");
  await writeFile(join(peer, `${name}.txt`), `${name}\n`);
  git(peer, "add", ".");
  git(peer, "commit", "-m", `Add ${name}`);
  git(peer, "push", "origin", "main");
}

test("project setup uses cumulative observation variants and reports all setup fixes", async () => {
  const root = await mkdtemp(join(tmpdir(), "silvermoon-unconfigured-"));
  temporaryDirectories.push(root);

  const missingGit = await whatsNext({
    language: "zh-cn",
    root,
    userHome: root,
  });
  assert.equal(missingGit.observation.state, "project-setup-required");
  assert.equal(missingGit.observation.observedThrough, "root");
  assert.equal(missingGit.intention.args.language, "zh-CN");
  assert.equal(missingGit.observation.outputLanguage, "zh-CN");
  assert.equal(Object.hasOwn(missingGit.observation, "version"), false);
  assert.deepEqual(
    missingGit.observation.problems.map(({ type }) => type),
    ["git-repository-missing", "config-missing", "canonical-skill-missing"],
  );
  assert.equal(missingGit.actions.length, 0);
  assert.match(responseText(missingGit), /^1\. .*\n2\. .*\n3\. /);
  assert.match(responseText(missingGit), /处理/);

  const configured = await fixture();
  await writeFile(
    join(configured.root, ".silvermoon", "config.yaml"),
    `version: 2
primaryRepository: ${PRIMARY_REPOSITORY}
primaryBranch: main
`,
  );
  git(configured.root, "add", ".");
  git(configured.root, "commit", "-m", "Break configuration");
  const invalidConfig = await whatsNext({
    root: configured.root,
    userHome: configured.base,
  });
  assert.equal(invalidConfig.observation.observedThrough, "version");
  assert.deepEqual(invalidConfig.observation.version, { type: "worktree" });
  assert.equal(
    Object.hasOwn(invalidConfig.observation, "configuration"),
    false,
  );
  assert.ok(
    invalidConfig.observation.problems.some(
      ({ type }) => type === "config-unsupported-version",
    ),
  );

  const missingSkill = await fixture({ preferredLanguage: "zh-CN" });
  await rm(join(missingSkill.root, ".agents"), { recursive: true });
  git(missingSkill.root, "add", "--all");
  git(missingSkill.root, "commit", "-m", "Remove canonical skill");
  const observedIdeas = await whatsNext({
    root: missingSkill.root,
    userHome: missingSkill.base,
  });
  assert.equal(observedIdeas.observation.observedThrough, "ideas");
  assert.equal(observedIdeas.observation.ideas.counts.preparing, 1);
  assert.equal(
    observedIdeas.observation.problems[0].type,
    "canonical-skill-missing",
  );
  assert.match(observedIdeas.observation.problems[0].summary, /^Silvermoon 发现/);
  assert.match(responseText(observedIdeas), /^处理/);
  assert.doesNotMatch(responseText(observedIdeas), /^\d+\. /m);
});

test("npm dependency setup blocks lifecycle navigation before fetching primary", async () => {
  const repository = await fixture();
  await writeFile(
    join(repository.root, "package.json"),
    JSON.stringify({ name: "consumer" }, null, 2) + "\n",
  );
  const commands = [];

  const report = await observeGitCommands(
    (args) => commands.push(args),
    () => whatsNext({
      idea: FIRST_ID,
      root: repository.root,
      userHome: repository.base,
    }),
  );

  assert.equal(report.observation.state, "project-setup-required");
  assert.equal(report.observation.problems[0].type, "npm-dependency-missing");
  assert.equal(report.actions.length, 0);
  assert.match(responseText(report), /silvermoon@\^[0-9]+\.[0-9]+\.[0-9]+/);
  assert.equal(commands.some(([name]) => name === "fetch"), false);
});

test("[selector-none] naked navigation lists one active idea without selecting it", async () => {
  const repository = await fixture();

  const report = await whatsNext({
    root: repository.root,
    userHome: repository.base,
  });

  assert.deepEqual(envelopeKeys(report), [
    "actions",
    "intention",
    "observation",
    "response",
  ]);
  assert.deepEqual(report.intention, {
    command: "whats-next",
    args: { idea: null, language: null },
  });
  assert.equal(report.observation.outputLanguage, "en-US");
  assert.equal(report.observation.state, "navigation-ready");
  assert.deepEqual(report.observation.ideas.activeIdeas, [{
    id: FIRST_ID,
    alias: "fixture",
    state: "preparing",
  }]);
  assert.doesNotMatch(responseText(report), new RegExp(FIRST_ID));
  assert.match(responseText(report), /silvermoon whats-next <ULID-or-alias>/);
  assert.match(responseText(report), /silvermoon create-idea/);
  assert.equal(report.actions[0].type, "fetch-primary");
  assert.equal(report.actions[0].status, "success");

  const localized = await whatsNext({
    language: "zh-cn",
    root: repository.root,
    userHome: repository.base,
  });
  assert.equal(localized.observation.state, "navigation-ready");
  assert.equal(localized.observation.outputLanguage, "zh-CN");
  assert.equal(
    localized.observation.configuration.preferredLanguage,
    "en-US",
  );
  assert.match(responseText(localized), /^请明确选择/);
  assert.match(localized.actions[0].result.commit, /^[0-9a-f]{40}$/);
  assert.equal(Object.hasOwn(localized.actions[0], "summary"), false);
});

test("empty navigation stays ready without selecting an idea", async () => {
  const repository = await fixture({ ideas: [] });
  const report = await whatsNext({
    root: repository.root,
    userHome: repository.base,
  });

  assert.equal(report.observation.state, "navigation-ready");
  assert.deepEqual(report.observation.ideas.activeIdeas, []);
  assert.equal(report.observation.ideas.counts.completed, 0);
  assert.equal(Object.hasOwn(report.observation, "selectedIdea"), false);
  assert.match(responseText(report), /create-idea/);
});

test("resolves the repository root when invoked from a nested directory", async () => {
  const repository = await fixture();
  const nested = join(repository.root, "nested", "directory");
  await mkdir(nested, { recursive: true });

  const report = await whatsNext({
    idea: FIRST_ID,
    root: nested,
    userHome: repository.base,
  });

  assert.equal(
    report.observation.root,
    resolve(git(nested, "rev-parse", "--show-toplevel")),
  );
  assert.equal(report.observation.state, "idea-selected");
  assert.equal(report.observation.selectedIdea.state, "preparing");
  assert.equal(Object.hasOwn(report.observation, "ideas"), false);
  assert.equal(Object.hasOwn(report.observation, "guidance"), false);
  assert.match(responseText(report), /approvedRevision/);
  assert.doesNotMatch(responseText(report), /道心|内景|现世/);
});

test("default navigation excludes completed and abandoned ideas while counting them", async () => {
  const repository = await fixture({
    ideas: [
      { id: FIRST_ID, status: { alias: "preparing" } },
      { id: SECOND_ID, status: { alias: "implementing" } },
      { id: DEPLOYING_ID, status: { alias: "deploying" } },
      { id: COMPLETED_ID, status: { alias: "completed" } },
      { id: ABANDONED_ID, status: { alias: "abandoned" } },
    ],
  });
  await setIdeaState(repository.root, SECOND_ID, "implementing", {
    alias: "implementing",
  });
  await setIdeaState(repository.root, DEPLOYING_ID, "deploying", {
    alias: "deploying",
  });
  await setIdeaState(repository.root, COMPLETED_ID, "completed", {
    alias: "completed",
  });
  await setIdeaState(repository.root, ABANDONED_ID, "abandoned", {
    alias: "abandoned",
  });
  git(repository.root, "add", ".");
  git(repository.root, "commit", "-m", "Set lifecycle states");
  git(repository.root, "push", "origin", "main");

  const report = await whatsNext({
    root: repository.root,
    userHome: repository.base,
  });

  assert.deepEqual(report.observation.ideas.counts, {
    preparing: 1,
    implementing: 1,
    deploying: 1,
    completed: 1,
    abandoned: 1,
  });
  assert.deepEqual(
    report.observation.ideas.activeIdeas.map(({ id }) => id),
    [FIRST_ID, SECOND_ID, DEPLOYING_ID].sort(),
  );
  assert.doesNotMatch(responseText(report), new RegExp(COMPLETED_ID));
  assert.doesNotMatch(responseText(report), new RegExp(ABANDONED_ID));

  for (const [id, phrase] of [
    [FIRST_ID, "approvedRevision"],
    [SECOND_ID, "implementationAcceptedRevision"],
    [DEPLOYING_ID, "deploymentAcceptedRevision"],
    [COMPLETED_ID, "completed idea"],
    [ABANDONED_ID, "abandoned idea"],
  ]) {
    const selected = await whatsNext({
      idea: id,
      root: repository.root,
      userHome: repository.base,
    });
    assert.equal(selected.intention.args.idea, id);
    assert.equal(selected.observation.state, "idea-selected");
    assert.equal(selected.observation.selectedIdea.id, id);
    assert.equal(Object.hasOwn(selected.observation, "ideas"), false);
    assert.match(responseText(selected), new RegExp(phrase));
  }
});

test("uses formal world and contract names in localized lifecycle instructions", async () => {
  const repository = await fixture({
    preferredLanguage: "fr-FR",
    ideas: [
      { id: FIRST_ID, status: { alias: "preparing" } },
      { id: SECOND_ID, status: { alias: "implementing" } },
      { id: DEPLOYING_ID, status: { alias: "deploying" } },
      { id: COMPLETED_ID, status: { alias: "completed" } },
      { id: ABANDONED_ID, status: { alias: "abandoned" } },
    ],
  });
  await setIdeaState(repository.root, SECOND_ID, "implementing", {
    alias: "implementing",
  });
  await setIdeaState(repository.root, DEPLOYING_ID, "deploying", {
    alias: "deploying",
  });
  await setIdeaState(repository.root, COMPLETED_ID, "completed", {
    alias: "completed",
  });
  await setIdeaState(repository.root, ABANDONED_ID, "abandoned", {
    alias: "abandoned",
  });
  git(repository.root, "add", ".");
  git(repository.root, "commit", "-m", "Set localized lifecycle states");
  git(repository.root, "push", "origin", "main");

  for (const [id, phrase] of [
    [FIRST_ID, "理想契约就绪"],
    [SECOND_ID, "除非理想契约确实需要变化"],
    [DEPLOYING_ID, "保留内层世界"],
    [COMPLETED_ID, "已完成 idea"],
    [ABANDONED_ID, "已放弃 idea"],
  ]) {
    const selected = await whatsNext({
      idea: id,
      language: "zh-cn",
      root: repository.root,
      userHome: repository.base,
    });
    assert.equal(selected.intention.args.language, "zh-CN");
    assert.equal(selected.observation.outputLanguage, "zh-CN");
    assert.equal(
      selected.observation.configuration.preferredLanguage,
      "fr-FR",
    );
    assert.match(responseText(selected), new RegExp(phrase));
    assert.doesNotMatch(responseText(selected), /道心|内景|现世/);
  }
});

test("[selector-unknown] reports an unknown selector without guessing", async () => {
  const repository = await fixture();

  const report = await whatsNext({
    idea: "unknown",
    language: "zh-CN",
    root: repository.root,
    userHome: repository.base,
  });

  assert.deepEqual(report.observation.problems, []);
  assert.equal(report.observation.state, "idea-not-found");
  assert.deepEqual(report.observation.candidates, [{
    id: FIRST_ID, alias: "fixture", state: "preparing",
  }]);
  assert.equal(report.observation.outputLanguage, "zh-CN");
  assert.equal(Object.hasOwn(report.observation, "selectedIdea"), false);
  assert.match(responseText(report), /未匹配/);
  assert.doesNotMatch(responseText(report), new RegExp(FIRST_ID));
  assert.match(responseText(report), /create-idea/);
});

test("[selector-known] [alias-absent] selects an alias-less idea only by explicit ULID", async () => {
  const repository = await fixture({
    ideas: [{ id: FIRST_ID, status: {} }],
  });

  const report = await whatsNext({
    idea: FIRST_ID,
    root: repository.root,
    userHome: repository.base,
  });

  assert.equal(report.observation.state, "idea-selected");
  assert.equal(
    Object.hasOwn(report.observation.selectedIdea, "alias"),
    false,
  );
  assert.match(responseText(report), new RegExp(FIRST_ID));
  assert.doesNotMatch(responseText(report), /undefined|\(\)/);
});

test("resolves preferred language for the selected idea without changing bare navigation", async () => {
  const repository = await fixture({
    ideas: [{
      id: FIRST_ID,
      status: { alias: "localized", language: "fr" },
    }],
  });

  const selected = await whatsNext({
    idea: FIRST_ID,
    root: repository.root,
    userHome: repository.base,
  });
  const bare = await whatsNext({
    root: repository.root,
    userHome: repository.base,
  });

  assert.equal(
    selected.observation.configuration.preferredLanguage,
    "fr",
  );
  assert.equal(selected.observation.outputLanguage, "en-US");
  assert.equal(
    bare.observation.configuration.preferredLanguage,
    "en-US",
  );
  assert.equal(bare.observation.outputLanguage, "en-US");
});

test("uses a canonical output override without changing content language or persisted status", async () => {
  const repository = await fixture({
    ideas: [{
      id: FIRST_ID,
      status: { alias: "localized", language: "fr-FR" },
    }],
  });
  const statusPath = join(
    repository.root,
    ".silvermoon",
    "ideas",
    FIRST_ID,
    "status.yaml",
  );
  const configPath = join(repository.root, ".silvermoon", "config.yaml");
  const before = await readFile(statusPath, "utf8");
  const configBefore = await readFile(configPath, "utf8");

  const selected = await whatsNext({
    idea: "localized",
    language: "ZH-cn",
    root: repository.root,
    userHome: repository.base,
  });

  assert.deepEqual(selected.intention.args, {
    idea: "localized",
    language: "zh-CN",
  });
  assert.equal(selected.observation.outputLanguage, "zh-CN");
  assert.equal(
    selected.observation.configuration.preferredLanguage,
    "fr-FR",
  );
  assert.match(responseText(selected), /^继续在 /);
  assert.match(selected.actions[0].result.commit, /^[0-9a-f]{40}$/);
  assert.equal(await readFile(statusPath, "utf8"), before);
  assert.equal(await readFile(configPath, "utf8"), configBefore);

  await writeFile(join(repository.root, "local.txt"), "preserve me\n");
  const blocked = await whatsNext({
    idea: "localized",
    language: "zh-CN",
    root: repository.root,
    userHome: repository.base,
  });

  assert.equal(blocked.observation.outputLanguage, "zh-CN");
  assert.match(responseText(blocked), /^检查全部 staged、unstaged 和 untracked 路径/);
  assert.match(
    responseText(blocked),
    /silvermoon whats-next "localized" --language zh-CN/,
  );
});

test("[dirty] reports local changes before any remote access and preserves selector intent", async () => {
  const repository = await fixture();
  await writeFile(join(repository.root, "local.txt"), "preserve me\n");
  const commands = [];

  const report = await observeGitCommands(
    (args) => commands.push(args),
    () => whatsNext({
      idea: FIRST_ID,
      root: repository.root,
      userHome: repository.base,
    }),
  );

  assert.equal(report.observation.state, "repository-sync-required");
  assert.equal(report.observation.problems[0].type, "worktree-changes");
  assert.match(report.observation.problems[0].summary, /untracked=1/);
  assert.equal(report.actions.length, 0);
  assert.equal(
    commands.some(([name]) => name === "fetch" || name === "ls-remote"),
    false,
  );
  assert.match(responseText(report), /^Inspect all staged, unstaged, and untracked paths and their changes/);
  assert.doesNotMatch(responseText(report), /git -C|diff --cached|status --short/);
  assert.doesNotMatch(responseText(report), /^\d+\. /m);
  assert.match(responseText(report), new RegExp(FIRST_ID));
});

test("localized worktree guidance covers all changes without prescribing diff commands", async () => {
  const repository = await fixture({ preferredLanguage: "zh-CN" });
  await writeFile(join(repository.root, "local.txt"), "preserve me\n");

  const report = await whatsNext({
    root: repository.root,
    userHome: repository.base,
  });

  assert.equal(report.observation.state, "repository-sync-required");
  assert.match(responseText(report), /^检查全部 staged、unstaged 和 untracked 路径及其修改内容/);
  assert.match(responseText(report), /不要只依据上述样例/);
  assert.doesNotMatch(responseText(report), /git -C|diff --cached|status --short/);
});

test("reports every observable local readiness problem before remote access", async () => {
  const repository = await fixture();
  await writeFile(join(repository.root, "local.txt"), "preserve me\n");
  git(repository.root, "config", "--unset", "branch.main.remote");
  git(repository.root, "config", "--unset", "branch.main.merge");
  const commands = [];

  const report = await observeGitCommands(
    (args) => commands.push(args),
    () => whatsNext({
      root: repository.root,
      userHome: repository.base,
    }),
  );

  assert.deepEqual(
    report.observation.problems.map(({ type }) => type),
    ["worktree-changes", "primary-upstream-mismatch"],
  );
  assert.equal(report.actions.length, 0);
  assert.equal(
    commands.some(([name]) => name === "fetch" || name === "ls-remote"),
    false,
  );
  assert.match(responseText(report), /^1\. Inspect all staged, unstaged, and untracked paths and their changes/);
  assert.match(responseText(report), /\n2\. Configure a named remote /);
  assert.match(responseText(report), /upstream/);
  assert.match(responseText(report), /silvermoon whats-next/);
});

test("[structured-changes] bounds large change summaries and requires full inspection", async () => {
  const repository = await fixture();
  for (let index = 0; index < 50; index += 1) {
    await writeFile(
      join(repository.root, `untracked-${String(index).padStart(2, "0")}.txt`),
      "fixture\n",
    );
  }

  const report = await whatsNext({
    root: repository.root,
    userHome: repository.base,
  });
  const problem = report.observation.problems[0];
  const sample = /samples=\[(.*)\]; omitted=(\d+)$/.exec(problem.summary);

  assert.ok(sample);
  assert.ok(sample[1].split(", ").length <= CHANGE_SAMPLE_ITEM_LIMIT);
  assert.equal(Number(sample[2]), 50 - CHANGE_SAMPLE_ITEM_LIMIT);
  assert.match(responseText(report), /Inspect all staged, unstaged, and untracked paths and their changes/);
  assert.match(responseText(report), /not just the samples above/);
  assert.doesNotMatch(responseText(report), /git -C|diff --cached|status --short/);
});

test("[conflict] prioritizes conflicts while still reporting all known changes", async () => {
  const repository = await fixture();
  await writeFile(join(repository.root, "conflict.txt"), "base\n");
  git(repository.root, "add", ".");
  git(repository.root, "commit", "-m", "Add conflict fixture");
  git(repository.root, "push", "origin", "main");
  git(repository.root, "checkout", "-b", "other");
  await writeFile(join(repository.root, "conflict.txt"), "other\n");
  git(repository.root, "add", ".");
  git(repository.root, "commit", "-m", "Change other");
  git(repository.root, "checkout", "main");
  await writeFile(join(repository.root, "conflict.txt"), "main\n");
  git(repository.root, "add", ".");
  git(repository.root, "commit", "-m", "Change main");
  const merged = spawnSync(
    "git",
    ["-C", repository.root, "merge", "other"],
    { encoding: "utf8", windowsHide: true },
  );
  assert.notEqual(merged.status, 0);
  await writeFile(join(repository.root, "extra.txt"), "extra\n");

  const report = await whatsNext({
    root: repository.root,
    userHome: repository.base,
  });

  assert.deepEqual(
    report.observation.problems.map(({ type }) => type),
    ["worktree-conflicts", "worktree-changes"],
  );
  assert.match(report.observation.problems[0].summary, /conflict\.txt/);
  assert.match(responseText(report), /^1\. Inspect every conflicted path and its contents/);
  assert.match(responseText(report), /\n2\. Inspect all staged, unstaged, and untracked paths and their changes/);
  assert.doesNotMatch(responseText(report), /git -C|diff --name-only|status --short/);
  assert.equal(report.actions.length, 0);
});

test("[branch-mismatch] accepts any local branch with the configured primary upstream", async () => {
  const repository = await fixture();
  git(repository.root, "checkout", "-b", "feature");
  git(repository.root, "branch", "--set-upstream-to=origin/main", "feature");

  const report = await whatsNext({
    idea: FIRST_ID,
    root: repository.root,
    userHome: repository.base,
  });

  assert.equal(report.observation.state, "idea-selected");
  assert.match(responseText(report), /approvedRevision/);

  git(repository.root, "branch", "--unset-upstream");
  const commands = [];
  const mismatch = await observeGitCommands(
    (args) => commands.push(args),
    () => whatsNext({
      idea: FIRST_ID,
      root: repository.root,
      userHome: repository.base,
    }),
  );
  assert.equal(
    mismatch.observation.problems[0].type,
    "primary-upstream-mismatch",
  );
  assert.match(responseText(mismatch), /'@\{upstream\}'/);
  assert.equal(
    commands.some(([name]) => name === "fetch" || name === "ls-remote"),
    false,
  );
});

test("[primary-relocation] follows newly configured primary coordinates after publication", async () => {
  const repository = await fixture();
  const relocated = join(repository.base, "relocated.git");
  const configured = "https://example.test/new-owner/new-repository.git";
  git(repository.root, "init", "--bare", "--initial-branch=main", relocated);
  git(
    repository.root,
    "config",
    `url.${pathToFileURL(relocated).href}.insteadOf`,
    configured,
  );
  git(repository.root, "remote", "set-url", "origin", configured);
  await writeFile(
    join(repository.root, ".silvermoon", "config.yaml"),
    `version: 1
primaryRepository: ${configured}
primaryBranch: main
`,
  );
  git(repository.root, "add", ".");
  git(repository.root, "commit", "-m", "Relocate primary");
  git(repository.root, "push", "--set-upstream", "origin", "main");

  const report = await whatsNext({
    idea: FIRST_ID,
    root: repository.root,
    userHome: repository.base,
  });

  assert.equal(report.observation.state, "idea-selected");
  assert.equal(
    report.observation.configuration.primaryRepository,
    configured,
  );
  assert.equal(report.actions[0].status, "success");
});

test("[behind] [ahead] [diverged] reports ancestry and safe remediation", async () => {
  const behindRepository = await fixture({ prefix: "silvermoon-behind-" });
  await pushPeerChange(behindRepository, "behind");
  const behind = await whatsNext({
    root: behindRepository.root,
    userHome: behindRepository.base,
  });
  assert.equal(behind.observation.problems[0].type, "primary-behind");
  assert.match(responseText(behind), /Fast-forward/);
  const primary = /observed primary is ([0-9a-f]+)/.exec(
    behind.observation.problems[0].summary,
  )[1];
  assert.match(responseText(behind), new RegExp(primary));
  assert.doesNotMatch(responseText(behind), /origin\/main/);
  git(behindRepository.root, "merge", "--ff-only", primary);
  const aligned = await whatsNext({
    root: behindRepository.root,
    userHome: behindRepository.base,
  });
  assert.equal(aligned.observation.state, "navigation-ready");

  const aheadRepository = await fixture({ prefix: "silvermoon-ahead-" });
  await writeFile(join(aheadRepository.root, "ahead.txt"), "ahead\n");
  git(aheadRepository.root, "add", ".");
  git(aheadRepository.root, "commit", "-m", "Advance locally");
  const ahead = await whatsNext({
    root: aheadRepository.root,
    userHome: aheadRepository.base,
  });
  assert.equal(ahead.observation.problems[0].type, "primary-ahead");
  assert.match(responseText(ahead), /without force/);
  assert.match(responseText(ahead), /expected|still/);

  const divergedRepository = await fixture({ prefix: "silvermoon-diverged-" });
  await pushPeerChange(divergedRepository, "remote");
  await writeFile(join(divergedRepository.root, "local.txt"), "local\n");
  git(divergedRepository.root, "add", ".");
  git(divergedRepository.root, "commit", "-m", "Advance locally");
  const diverged = await whatsNext({
    root: divergedRepository.root,
    userHome: divergedRepository.base,
  });
  assert.equal(diverged.observation.problems[0].type, "primary-diverged");
  assert.match(responseText(diverged), /both histories/);
});

test("records fetch failure as a failure outcome with a trustworthy envelope", async () => {
  const repository = await fixture();
  await rm(repository.remote, { recursive: true });

  const report = await whatsNext({
    root: repository.root,
    userHome: repository.base,
  });

  assert.equal(report.observation.state, "repository-sync-required");
  assert.equal(report.observation.problems[0].type, "primary-fetch-failed");
  assert.equal(report.actions.at(-1).type, "fetch-primary");
  assert.equal(report.actions.at(-1).status, "failure");
  assert.match(responseText(report), /network|网络/);
});

test("rejects an unsupported programmatic output language before repository inspection", async () => {
  const repository = await fixture();
  const commands = [];

  await assert.rejects(
    observeGitCommands(
      (args) => commands.push(args),
      () => whatsNext({
        language: "fr-FR",
        root: repository.root,
      }),
    ),
    (error) => error.exitCode === 2,
  );
  assert.deepEqual(commands, []);
});

test("attaches only the selected actionable phase guidance from primary", async () => {
  const repository = await fixture({
    ideas: [
      { id: FIRST_ID, status: { alias: "preparing" } },
      { id: SECOND_ID, status: { alias: "implementing" } },
      { id: DEPLOYING_ID, status: { alias: "deploying" } },
    ],
  });
  await setIdeaState(repository.root, SECOND_ID, "implementing", {
    alias: "implementing",
  });
  await setIdeaState(repository.root, DEPLOYING_ID, "deploying", {
    alias: "deploying",
  });
  const fixtures = [
    [FIRST_ID, "preparing", "# Prepare\n\nPreparing only.\n"],
    [SECOND_ID, "implementing", "# Implement\n\nImplementing only.\n"],
    [DEPLOYING_ID, "deploying", "# Deploy\n\nDeploying only.\n"],
  ];
  await mkdir(join(repository.root, ...GUIDANCE_ROOT.split("/")), {
    recursive: true,
  });
  for (const [, phase, content] of fixtures) {
    await writeFile(
      join(repository.root, ...phaseGuidancePath(phase).split("/")),
      content,
    );
  }
  git(repository.root, "add", ".");
  git(repository.root, "commit", "-m", "Add phase guidance");
  git(repository.root, "push", "origin", "main");

  for (const [id, phase, content] of fixtures) {
    const report = await whatsNext({
      idea: id,
      language: "zh-CN",
      root: repository.root,
      userHome: repository.base,
    });
    const path = phaseGuidancePath(phase);

    assert.equal(report.observation.state, "idea-selected");
    assert.deepEqual(report.observation.guidance, {
      phase,
      path,
      contentRevision: git(repository.root, "rev-parse", `HEAD:${path}`),
    });
    assert.equal(report.response.guidance.content, content);
    assert.equal(
      fixtures
        .filter(([, candidate]) => candidate !== phase)
        .some(([, , otherContent]) =>
          JSON.stringify(report).includes(otherContent.trim())
        ),
      false,
    );
    assert.match(responseText(report), /revision/);
    assert.doesNotMatch(responseText(report), /Preparing only|Implementing only|Deploying only/);
  }
});

test("loads guidance only after an actionable idea becomes the next action", async () => {
  const repository = await fixture({
    ideas: [
      { id: FIRST_ID, status: { alias: "active" } },
      { id: COMPLETED_ID, status: { alias: "completed" } },
      { id: ABANDONED_ID, status: { alias: "abandoned" } },
    ],
  });
  await setIdeaState(repository.root, COMPLETED_ID, "completed", {
    alias: "completed",
  });
  await setIdeaState(repository.root, ABANDONED_ID, "abandoned", {
    alias: "abandoned",
  });
  git(repository.root, "add", ".");
  git(repository.root, "commit", "-m", "Set terminal idea states");
  git(repository.root, "push", "origin", "main");
  let reads = 0;
  const guidanceReader = async () => {
    reads += 1;
    throw new Error("guidance must not be read");
  };

  for (const options of [
    {},
    { idea: "unknown" },
    { idea: COMPLETED_ID },
    { idea: ABANDONED_ID },
  ]) {
    const report = await whatsNext({
      ...options,
      guidanceReader,
      root: repository.root,
      userHome: repository.base,
    });
    assert.notEqual(report.observation.state, "phase-guidance-invalid");
  }

  await writeFile(join(repository.root, "dirty.txt"), "preserve\n");
  const blocked = await whatsNext({
    guidanceReader,
    idea: FIRST_ID,
    root: repository.root,
    userHome: repository.base,
  });
  assert.equal(blocked.observation.state, "repository-sync-required");
  assert.equal(reads, 0);
});

test("does not load guidance while setup, upstream, or fetch readiness is blocked", async () => {
  let reads = 0;
  const guidanceReader = async () => {
    reads += 1;
    throw new Error("guidance must not be read");
  };

  const setup = await fixture();
  await rm(join(setup.root, ".agents"), { recursive: true });
  const setupReport = await whatsNext({
    guidanceReader,
    idea: FIRST_ID,
    root: setup.root,
    userHome: setup.base,
  });
  assert.equal(setupReport.observation.state, "project-setup-required");

  const upstream = await fixture();
  git(upstream.root, "branch", "--unset-upstream");
  const upstreamReport = await whatsNext({
    guidanceReader,
    idea: FIRST_ID,
    root: upstream.root,
    userHome: upstream.base,
  });
  assert.equal(upstreamReport.observation.state, "repository-sync-required");

  const fetch = await fixture();
  await rm(fetch.remote, { recursive: true });
  const fetchReport = await whatsNext({
    guidanceReader,
    idea: FIRST_ID,
    root: fetch.root,
    userHome: fetch.base,
  });
  assert.equal(fetchReport.observation.state, "repository-sync-required");
  assert.equal(fetchReport.observation.problems[0].type, "primary-fetch-failed");
  assert.equal(reads, 0);
});

test("current guidance failures block lifecycle instructions without cross-phase leakage", async () => {
  const repository = await fixture({
    ideas: [
      { id: FIRST_ID, status: { alias: "preparing" } },
      { id: SECOND_ID, status: { alias: "implementing" } },
    ],
  });
  await setIdeaState(repository.root, SECOND_ID, "implementing", {
    alias: "implementing",
  });
  await mkdir(join(repository.root, ...GUIDANCE_ROOT.split("/")), {
    recursive: true,
  });
  await writeFile(
    join(repository.root, ...phaseGuidancePath("preparing").split("/")),
    "Prepare safely.\n",
  );
  await mkdir(
    join(repository.root, ...phaseGuidancePath("implementing").split("/")),
  );
  await writeFile(
    join(
      repository.root,
      ...phaseGuidancePath("implementing").split("/"),
      "nested.md",
    ),
    "invalid\n",
  );
  await writeFile(
    join(repository.root, GUIDANCE_ROOT, "unexpected.md"),
    "ignored on demand\n",
  );
  git(repository.root, "add", ".");
  git(repository.root, "commit", "-m", "Add mixed guidance");
  git(repository.root, "push", "origin", "main");

  const preparing = await whatsNext({
    idea: FIRST_ID,
    root: repository.root,
    userHome: repository.base,
  });
  const implementing = await whatsNext({
    idea: SECOND_ID,
    root: repository.root,
    userHome: repository.base,
  });

  assert.equal(preparing.observation.state, "idea-selected");
  assert.equal(preparing.response.guidance.content, "Prepare safely.\n");
  assert.equal(
    Object.hasOwn(preparing.observation.guidance, "content"),
    false,
  );
  assert.equal(implementing.observation.state, "phase-guidance-invalid");
  assert.deepEqual(
    implementing.observation.problems.map(({ type }) => type),
    ["guidance-file-invalid"],
  );
  assert.equal(Object.hasOwn(implementing.observation, "guidance"), false);
  assert.doesNotMatch(
    responseText(implementing),
    /implementationAcceptedRevision/,
  );
  assert.match(responseText(implementing), /implementing\.md/);
});

test("keeps a formed guidance report bound to the inspected snapshot", async () => {
  const repository = await fixture();
  const path = phaseGuidancePath("preparing");
  await mkdir(join(repository.root, ...GUIDANCE_ROOT.split("/")), {
    recursive: true,
  });
  await writeFile(join(repository.root, ...path.split("/")), "Original guidance.\n");
  git(repository.root, "add", ".");
  git(repository.root, "commit", "-m", "Add preparing guidance");
  git(repository.root, "push", "origin", "main");
  const expectedRevision = git(repository.root, "rev-parse", `HEAD:${path}`);

  const report = await whatsNext({
    guidanceReader: async (options) => {
      const inspected = await inspectPhaseGuidance(options);
      await writeFile(
        join(repository.root, ...path.split("/")),
        "Concurrent replacement.\n",
      );
      return inspected;
    },
    idea: FIRST_ID,
    root: repository.root,
    userHome: repository.base,
  });

  assert.equal(report.observation.state, "idea-selected");
  assert.equal(report.response.guidance.content, "Original guidance.\n");
  assert.equal(
    report.observation.guidance.contentRevision,
    expectedRevision,
  );
});
