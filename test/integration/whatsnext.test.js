import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, test } from "node:test";
import { pathToFileURL } from "node:url";

import { observeGitCommands } from "../../src/git.js";
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

  const missingGit = await whatsNext({ root, userHome: root });
  assert.equal(missingGit.observation.state, "project-setup-required");
  assert.equal(missingGit.observation.observedThrough, "root");
  assert.equal(Object.hasOwn(missingGit.observation, "version"), false);
  assert.deepEqual(
    missingGit.observation.problems.map(({ type }) => type),
    ["git-repository-missing", "config-missing", "canonical-skill-missing"],
  );
  assert.equal(missingGit.outcomes.length, 0);
  assert.match(missingGit.instructions, /^1\. .*\n2\. .*\n3\. /);

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
  assert.match(observedIdeas.instructions, /^处理/);
  assert.doesNotMatch(observedIdeas.instructions, /^\d+\. /m);
});

test("[selector-none] naked navigation lists one active idea without selecting it", async () => {
  const repository = await fixture();

  const report = await whatsNext({
    root: repository.root,
    userHome: repository.base,
  });

  assert.deepEqual(envelopeKeys(report), [
    "instructions",
    "intention",
    "observation",
    "outcomes",
  ]);
  assert.deepEqual(report.intention, {
    command: "whats-next",
    args: { idea: null },
  });
  assert.equal(report.observation.state, "navigation-ready");
  assert.deepEqual(report.observation.ideas.activeIdeas, [{
    id: FIRST_ID,
    alias: "fixture",
    state: "preparing",
  }]);
  assert.doesNotMatch(report.instructions, new RegExp(FIRST_ID));
  assert.match(report.instructions, /silvermoon whats-next <ULID-or-alias>/);
  assert.match(report.instructions, /silvermoon create-idea/);
  assert.equal(report.outcomes[0].type, "fetch-primary");
  assert.equal(report.outcomes[0].status, "success");
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
  assert.match(report.instructions, /create-idea/);
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
  assert.match(report.instructions, /approvedRevision/);
  assert.doesNotMatch(report.instructions, /道心|内景|现世/);
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
  assert.doesNotMatch(report.instructions, new RegExp(COMPLETED_ID));
  assert.doesNotMatch(report.instructions, new RegExp(ABANDONED_ID));

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
    assert.match(selected.instructions, new RegExp(phrase));
  }
});

test("uses formal world and contract names in localized lifecycle instructions", async () => {
  const repository = await fixture({
    preferredLanguage: "zh-CN",
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
  git(repository.root, "add", ".");
  git(repository.root, "commit", "-m", "Set localized lifecycle states");
  git(repository.root, "push", "origin", "main");

  for (const [id, phrase] of [
    [FIRST_ID, "理想契约就绪"],
    [SECOND_ID, "除非理想契约确实需要变化"],
    [DEPLOYING_ID, "保留内层世界"],
  ]) {
    const selected = await whatsNext({
      idea: id,
      root: repository.root,
      userHome: repository.base,
    });
    assert.match(selected.instructions, new RegExp(phrase));
    assert.doesNotMatch(selected.instructions, /道心|内景|现世/);
  }
});

test("[selector-unknown] reports an unknown selector without guessing", async () => {
  const repository = await fixture();

  const report = await whatsNext({
    idea: "unknown",
    root: repository.root,
    userHome: repository.base,
  });

  assert.deepEqual(report.observation.problems, []);
  assert.equal(report.observation.state, "idea-not-found");
  assert.deepEqual(report.observation.candidates, [{
    id: FIRST_ID, alias: "fixture", state: "preparing",
  }]);
  assert.equal(Object.hasOwn(report.observation, "selectedIdea"), false);
  assert.match(report.instructions, /does not match/);
  assert.doesNotMatch(report.instructions, new RegExp(FIRST_ID));
  assert.match(report.instructions, /create-idea/);
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
  assert.match(report.instructions, new RegExp(FIRST_ID));
  assert.doesNotMatch(report.instructions, /undefined|\(\)/);
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
  assert.equal(
    bare.observation.configuration.preferredLanguage,
    "en-US",
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
  assert.equal(report.outcomes.length, 0);
  assert.equal(
    commands.some(([name]) => name === "fetch" || name === "ls-remote"),
    false,
  );
  assert.match(report.instructions, /^Inspect all staged, unstaged, and untracked paths and their changes/);
  assert.doesNotMatch(report.instructions, /git -C|diff --cached|status --short/);
  assert.doesNotMatch(report.instructions, /^\d+\. /m);
  assert.match(report.instructions, new RegExp(FIRST_ID));
});

test("localized worktree guidance covers all changes without prescribing diff commands", async () => {
  const repository = await fixture({ preferredLanguage: "zh-CN" });
  await writeFile(join(repository.root, "local.txt"), "preserve me\n");

  const report = await whatsNext({
    root: repository.root,
    userHome: repository.base,
  });

  assert.equal(report.observation.state, "repository-sync-required");
  assert.match(report.instructions, /^检查全部 staged、unstaged 和 untracked 路径及其修改内容/);
  assert.match(report.instructions, /不要只依据上述样例/);
  assert.doesNotMatch(report.instructions, /git -C|diff --cached|status --short/);
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
  assert.equal(report.outcomes.length, 0);
  assert.equal(
    commands.some(([name]) => name === "fetch" || name === "ls-remote"),
    false,
  );
  assert.match(report.instructions, /^1\. Inspect all staged, unstaged, and untracked paths and their changes/);
  assert.match(report.instructions, /\n2\. Configure a named remote /);
  assert.match(report.instructions, /upstream/);
  assert.match(report.instructions, /silvermoon whats-next/);
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
  assert.match(report.instructions, /Inspect all staged, unstaged, and untracked paths and their changes/);
  assert.match(report.instructions, /not just the samples above/);
  assert.doesNotMatch(report.instructions, /git -C|diff --cached|status --short/);
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
  assert.match(report.instructions, /^1\. Inspect every conflicted path and its contents/);
  assert.match(report.instructions, /\n2\. Inspect all staged, unstaged, and untracked paths and their changes/);
  assert.doesNotMatch(report.instructions, /git -C|diff --name-only|status --short/);
  assert.equal(report.outcomes.length, 0);
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
  assert.match(report.instructions, /approvedRevision/);

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
  assert.match(mismatch.instructions, /'@\{upstream\}'/);
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
  assert.equal(report.outcomes[0].status, "success");
});

test("[behind] [ahead] [diverged] reports ancestry and safe remediation", async () => {
  const behindRepository = await fixture({ prefix: "silvermoon-behind-" });
  await pushPeerChange(behindRepository, "behind");
  const behind = await whatsNext({
    root: behindRepository.root,
    userHome: behindRepository.base,
  });
  assert.equal(behind.observation.problems[0].type, "primary-behind");
  assert.match(behind.instructions, /Fast-forward/);
  const primary = /observed primary is ([0-9a-f]+)/.exec(
    behind.observation.problems[0].summary,
  )[1];
  assert.match(behind.instructions, new RegExp(primary));
  assert.doesNotMatch(behind.instructions, /origin\/main/);
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
  assert.match(ahead.instructions, /without force/);
  assert.match(ahead.instructions, /expected|still/);

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
  assert.match(diverged.instructions, /both histories/);
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
  assert.equal(report.outcomes.at(-1).type, "fetch-primary");
  assert.equal(report.outcomes.at(-1).status, "failure");
  assert.match(report.instructions, /network|网络/);
});
