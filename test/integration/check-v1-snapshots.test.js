import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, test } from "node:test";

import { observeGitCommands } from "../../src/git.js";
import { checkRepository } from "../../src/index.js";
import {
  REPOSITORY_SKILL_PATH,
  SILVERMOON_VERSION,
} from "../../src/adoption.js";
import { serializeIdeaStatus } from "../../src/ideas.js";
import {
  GUIDANCE_ROOT,
  ideaPaths,
  phaseGuidancePath,
} from "../../src/layout.js";
import {
  FIRST_ID,
  git,
} from "../helpers/repository.js";
import { createCheckV1TestHelpers } from "../helpers/check-v1.js";

const { fixture, trackTemporaryDirectory } = createCheckV1TestHelpers(afterEach);

test("checks HEAD with a project-only observation and resolved commit version", async () => {
  const repository = await fixture();
  const commit = git(repository.root, "rev-parse", "HEAD");

  const report = await checkRepository({
    root: repository.root,
    userHome: repository.base,
  });

  assert.deepEqual(Object.keys(report).sort(), [
    "actions",
    "intention",
    "observation",
    "response",
  ]);
  assert.deepEqual(report.intention, {
    command: "check",
    args: { target: { type: "head" }, language: null },
  });
  assert.equal(report.observation.outputLanguage, "en-US");
  assert.deepEqual(report.observation.version, {
    type: "commit",
    commit,
  });
  assert.equal(report.observation.state, "project-ready");
  assert.equal(report.observation.ideas.counts.preparing, 1);
  assert.deepEqual(report.observation.problems, []);
});

test("validates every snapshot target in a SHA-256 repository", async () => {
  const repository = await fixture({
    objectFormat: "sha256",
    withRemote: true,
  });
  const commit = git(repository.root, "rev-parse", "HEAD");

  for (const target of [
    {},
    { commit: "HEAD" },
    { staged: true },
    { worktree: true },
    { remote: true },
  ]) {
    const report = await checkRepository({
      ...target,
      root: repository.root,
      userHome: repository.base,
    });
    assert.equal(report.observation.state, "project-ready");
    assert.deepEqual(report.observation.problems, []);
    if (report.observation.version.commit) {
      assert.equal(report.observation.version.commit, commit);
      assert.match(report.observation.version.commit, /^[0-9a-f]{64}$/);
    }
  }
});

test("checks root npm dependency from each selected snapshot without node_modules", async () => {
  const repository = await fixture({ withRemote: true });
  const manifestPath = join(repository.root, "package.json");
  const expectedRange = `^${SILVERMOON_VERSION}`;
  const invalidRange = expectedRange === "^0.0.0" ? "^0.0.1" : "^0.0.0";
  const validManifest = {
    name: "consumer",
    devDependencies: { silvermoon: expectedRange },
  };
  const invalidManifest = {
    ...validManifest,
    devDependencies: { silvermoon: invalidRange },
  };
  await writeFile(manifestPath, `${JSON.stringify(validManifest, null, 2)}\n`);
  git(repository.root, "add", "package.json");
  git(repository.root, "commit", "-m", "Add the root Silvermoon devDependency");
  git(repository.root, "push", "origin", "main");
  const validCommit = git(repository.root, "rev-parse", "HEAD");
  await writeFile(manifestPath, `${JSON.stringify(invalidManifest, null, 2)}\n`);
  git(repository.root, "add", "package.json");
  await writeFile(manifestPath, `${JSON.stringify(validManifest, null, 2)}\n`);

  const head = await checkRepository({
    root: repository.root,
    userHome: repository.base,
  });
  const commit = await checkRepository({
    commit: validCommit,
    root: repository.root,
    userHome: repository.base,
  });
  const staged = await checkRepository({
    staged: true,
    root: repository.root,
    userHome: repository.base,
  });
  const worktree = await checkRepository({
    worktree: true,
    root: repository.root,
    userHome: repository.base,
  });
  const remote = await checkRepository({
    remote: true,
    root: repository.root,
    userHome: repository.base,
  });

  assert.equal(head.observation.state, "project-ready");
  assert.equal(commit.observation.state, "project-ready");
  assert.equal(staged.observation.state, "project-setup-required");
  assert.equal(staged.observation.problems[0].type, "npm-dependency-version-mismatch");
  assert.equal(worktree.observation.state, "project-ready");
  assert.equal(remote.observation.state, "project-ready");
  await assert.rejects(readFile(join(repository.root, "node_modules")), {
    code: "ENOENT",
  });
});

test("accepts canonical skill line endings across every snapshot target", async () => {
  const repository = await fixture({ withRemote: true });
  const skillPath = join(
    repository.root,
    ...REPOSITORY_SKILL_PATH.split("/"),
    "SKILL.md",
  );
  const source = await readFile(skillPath, "utf8");
  const lf = source.replaceAll("\r\n", "\n");
  await writeFile(
    skillPath,
    source.includes("\r\n") ? lf : lf.replaceAll("\n", "\r\n"),
  );
  git(repository.root, "add", ".");
  git(repository.root, "commit", "-m", "Use alternate skill line endings");
  git(repository.root, "push", "origin", "main");

  for (const target of [
    {},
    { commit: "HEAD" },
    { remote: true },
    { staged: true },
    { worktree: true },
  ]) {
    const report = await checkRepository({
      ...target,
      root: repository.root,
      userHome: repository.base,
    });

    assert.equal(report.observation.state, "project-ready");
    assert.deepEqual(report.observation.problems, []);
  }
});

test("keeps the requested revision in intention and only the resolved commit in observation", async () => {
  const repository = await fixture();
  const expected = git(repository.root, "rev-parse", "HEAD");

  const report = await checkRepository({
    commit: "HEAD~0",
    root: repository.root,
    userHome: repository.base,
  });

  assert.deepEqual(report.intention.args.target, {
    type: "commit",
    revision: "HEAD~0",
  });
  assert.deepEqual(report.observation.version, {
    type: "commit",
    commit: expected,
  });
});

test("applies a canonical output override independently across every check target", async () => {
  const repository = await fixture();
  const targets = [
    {},
    { commit: "HEAD" },
    { staged: true },
    { worktree: true },
    { remote: true },
  ];

  for (const target of targets) {
    const baseline = await checkRepository({
      ...target,
      root: repository.root,
      userHome: repository.base,
    });
    const localized = await checkRepository({
      ...target,
      language: "ZH-cn",
      root: repository.root,
      userHome: repository.base,
    });
    const { outputLanguage: _baselineLanguage, ...baselineObservation } =
      baseline.observation;
    const { outputLanguage: _localizedLanguage, ...localizedObservation } =
      localized.observation;

    assert.equal(localized.intention.args.language, "zh-CN");
    assert.equal(localized.observation.outputLanguage, "zh-CN");
    assert.deepEqual(localized.intention.args.target, baseline.intention.args.target);
    assert.deepEqual(localizedObservation, baselineObservation);
  }
});

test("validates identical trees independently of target and parent topology", async () => {
  const repository = await fixture({ withRemote: true });
  const paths = ideaPaths(FIRST_ID);
  const rootCommit = git(repository.root, "rev-parse", "HEAD");
  const historicalRevision = "0".repeat(40);
  await writeFile(
    join(repository.root, ...paths.statusPath.split("/")),
    serializeIdeaStatus({
      version: 1,
      id: FIRST_ID,
      alias: "fixture",
      approvedRevision: historicalRevision,
    }),
  );
  git(repository.root, "add", "--all");
  git(repository.root, "commit", "-m", "Retain historical approval fact");
  const snapshotCommit = git(repository.root, "rev-parse", "HEAD");
  const snapshotTree = git(repository.root, "rev-parse", `${snapshotCommit}^{tree}`);
  const rootFirst = git(
    repository.root,
    "commit-tree",
    snapshotTree,
    "-p",
    rootCommit,
    "-p",
    snapshotCommit,
    "-m",
    "Merge with root first",
  );
  const snapshotFirst = git(
    repository.root,
    "commit-tree",
    snapshotTree,
    "-p",
    snapshotCommit,
    "-p",
    rootCommit,
    "-m",
    "Merge with snapshot first",
  );
  git(repository.root, "push", "origin", "main");
  const commands = [];

  const { reports, rootReport } = await observeGitCommands(
    (args) => commands.push(args),
    async () => {
      const rootReport = await checkRepository({
        commit: rootCommit,
        root: repository.root,
        userHome: repository.base,
      });
      const reports = [];
      for (const target of [
        {},
        { commit: snapshotCommit },
        { commit: rootFirst },
        { commit: snapshotFirst },
        { staged: true },
        { worktree: true },
        { remote: true },
      ]) {
        reports.push(await checkRepository({
          ...target,
          root: repository.root,
          userHome: repository.base,
        }));
      }
      return { reports, rootReport };
    },
  );

  assert.equal(rootReport.observation.state, "project-ready");
  const comparable = ({ version: _version, ...observation }) => observation;
  const expected = comparable(reports[0].observation);
  assert.equal(expected.state, "project-ready");
  assert.equal(expected.ideas.counts.preparing, 1);
  for (const report of reports.slice(1)) {
    assert.deepEqual(comparable(report.observation), expected);
  }
  assert.equal(
    commands.some(([name, ...args]) =>
      name === "rev-parse" && args.some((argument) => argument.endsWith("^1"))
    ),
    false,
  );
  assert.equal(commands.some(([name]) => name === "show"), false);
  // V1 facts remain snapshot-only; config ancestry only prevents v2 downgrades.
  for (const args of commands.filter(([name]) => name === "log")) {
    assert.deepEqual(args.slice(-2), ["--", ".silvermoon/config.yaml"]);
  }
  assert.equal(
    commands.some(([name, ...args]) =>
      name === "cat-file" && args.includes(historicalRevision)
    ),
    false,
  );
});

test("checks from a nested directory against the discovered Git root", async () => {
  const repository = await fixture();
  const nested = join(repository.root, "nested", "directory");
  await mkdir(nested, { recursive: true });

  const report = await checkRepository({
    root: nested,
    userHome: repository.base,
  });

  assert.equal(
    report.observation.root,
    resolve(git(nested, "rev-parse", "--show-toplevel")),
  );
  assert.equal(report.observation.state, "project-ready");
});

test("validates isolated staged and worktree candidates without Git worktree commands", async () => {
  const repository = await fixture();
  const ledger = join(
    repository.root,
    ...ideaPaths(FIRST_ID).ledgerPath.split("/"),
  );
  await rm(ledger);
  const commands = [];

  const worktree = await observeGitCommands(
    (args) => commands.push(args),
    () => checkRepository({
      root: repository.root,
      userHome: repository.base,
      worktree: true,
    }),
  );
  const head = await checkRepository({
    root: repository.root,
    userHome: repository.base,
  });
  git(repository.root, "add", "--all");
  const staged = await checkRepository({
    root: repository.root,
    staged: true,
    userHome: repository.base,
  });

  assert.equal(head.observation.state, "project-ready");
  for (const report of [worktree, staged]) {
    assert.equal(report.observation.state, "project-setup-required");
    assert.equal(report.observation.observedThrough, "configuration");
    assert.ok(
      report.observation.problems.some(
        ({ type }) => type === "idea-ledger-missing-file",
      ),
    );
  }
  assert.equal(
    commands.some(([name]) => name === "worktree"),
    false,
  );
  const checkoutCommands = commands.filter(
    ([name]) => name === "checkout-index",
  );
  assert.deepEqual(checkoutCommands, []);
});

test("fetches and validates remote without a dialogue outcome", async () => {
  const repository = await fixture({ withRemote: true });
  const expected = git(repository.root, "rev-parse", "HEAD");

  const report = await checkRepository({
    remote: true,
    root: repository.root,
    userHome: repository.base,
  });

  assert.deepEqual(report.observation.version, {
    type: "remote",
    commit: expected,
  });
  assert.equal(report.observation.state, "project-ready");
  assert.deepEqual(Object.keys(report).sort(), [
    "actions",
    "intention",
    "observation",
    "response",
  ]);
  assert.deepEqual(
    report.actions.map(({ type, status }) => [type, status]),
    [["fetch-primary", "success"]],
  );
});
