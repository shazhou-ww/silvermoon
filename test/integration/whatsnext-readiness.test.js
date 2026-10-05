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

import { observeGitCommands } from "../../src/foundation/git/index.js";
import { inspectPhaseGuidance } from "../../src/foundation/guidance/index.js";
import {
  GUIDANCE_ROOT,
  phaseGuidancePath,
} from "../../src/foundation/coordinates/index.js";
import {
  CHANGE_SAMPLE_ITEM_LIMIT,
  whatsNext,
} from "../../src/business/whats-next.js";
import { renderResponse } from "../../src/foundation/renderer/index.js";
import {
  createRepository,
  FIRST_ID,
  git,
  PRIMARY_REPOSITORY,
  SECOND_ID,
  setIdeaState,
} from "../helpers/repository.js";
import { createWhatsNextTestHelpers } from "../helpers/whatsnext.js";

const {
  envelopeKeys,
  fixture,
  pushPeerChange,
  responseText,
  trackTemporaryDirectory,
} = createWhatsNextTestHelpers(afterEach);
const DEPLOYING_ID = "01M36QGPNTXEPP61DA4KP4AVG1";
const COMPLETED_ID = "01M36QGPNTXEPP61DA4KP4AVG2";
const ABANDONED_ID = "01M36QGPNTXEPP61DA4KP4AVG3";

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

  const alignedCommands = [];
  const report = await observeGitCommands(
    (args) => alignedCommands.push(args),
    () => whatsNext({
      idea: FIRST_ID,
      root: repository.root,
      userHome: repository.base,
    }),
  );

  assert.equal(report.observation.state, "idea-selected");
  assert.match(responseText(report), /approvedRevision/);
  const readinessCommands = alignedCommands.filter((args) =>
    ["config", "status", "symbolic-ref"].includes(args[0])
    || (args[0] === "rev-parse" && args[1] === "--verify")
  );
  assert.deepEqual(
    readinessCommands.map(([name]) => name),
    ["status", "config"],
  );
  assert.equal(
    alignedCommands.filter(([name]) => name === "fetch").length,
    1,
  );

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
