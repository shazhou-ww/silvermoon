import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, test } from "node:test";

import { observeGitCommands } from "../../src/git.js";
import { checkRepository } from "../../src/index.js";
import { serializeIdeaStatus } from "../../src/ideas.js";
import {
  GUIDANCE_ROOT,
  ideaPaths,
  phaseGuidancePath,
} from "../../src/layout.js";
import {
  createRepository,
  FIRST_ID,
  git,
} from "../helpers/repository.js";

const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true })
    ),
  );
});

async function fixture() {
  const repository = await createRepository({
    prefix: "silvermoon-check-",
  });
  temporaryDirectories.push(repository.base);
  return repository;
}

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
  const repository = await fixture();
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
  assert.equal(commands.some(([name]) => name === "log"), false);
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
});

test("fetches and validates remote without a dialogue outcome", async () => {
  const repository = await fixture();
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

test("valid remote snapshot is not blocked by unrelated local HEAD skill damage", async () => {
  const repository = await fixture();
  const skill = join(repository.root, ".agents", "skills", "silvermoon");
  await rm(skill, { recursive: true });
  git(repository.root, "add", "--all");
  git(repository.root, "commit", "-m", "Damage local skill");

  const report = await checkRepository({
    remote: true,
    root: repository.root,
    userHome: repository.base,
  });

  assert.equal(report.observation.state, "project-ready");
  assert.equal(
    report.observation.version.commit,
    git(repository.root, "rev-parse", "HEAD~1"),
  );
  assert.deepEqual(report.observation.problems, []);
});

test("remote check reports invalid HEAD primary coordinates before fetching", async () => {
  const repository = await fixture();
  await writeFile(
    join(repository.root, ".silvermoon", "config.yaml"),
    "version: 1\nprimaryRepository: invalid\nprimaryBranch: main\n",
  );
  git(repository.root, "add", "--all");
  git(repository.root, "commit", "-m", "Break local primary coordinates");
  const commands = [];

  const report = await observeGitCommands(
    (args) => commands.push(args),
    () => checkRepository({
      language: "zh-CN",
      remote: true,
      root: repository.root,
      userHome: repository.base,
    }),
  );

  assert.equal(report.observation.state, "project-setup-required");
  assert.equal(report.observation.observedThrough, "version");
  assert.deepEqual(report.observation.version, { type: "remote", commit: null });
  assert.equal(report.observation.outputLanguage, "zh-CN");
  assert.equal(report.observation.problems[0].type, "config-invalid-primary-repository");
  assert.match(report.observation.problems[0].summary, /^在 /);
  assert.equal(
    commands.some(([name]) => name === "fetch" || name === "ls-remote"),
    false,
  );
});

test("returns a check-unavailable observation for an unavailable commit", async () => {
  const repository = await fixture();

  const report = await checkRepository({
    commit: "missing-revision",
    root: repository.root,
    userHome: repository.base,
  });

  assert.deepEqual(report.observation.version, {
    type: "commit",
    commit: null,
  });
  assert.equal(report.observation.state, "check-unavailable");
  assert.equal(report.observation.problems[0].type, "commit-unavailable");
  assert.deepEqual(Object.keys(report).sort(), [
    "actions",
    "intention",
    "observation",
    "response",
  ]);
});

test("keeps an output override when the requested check snapshot is unavailable", async () => {
  const repository = await fixture();

  const report = await checkRepository({
    commit: "missing-revision",
    language: "zh-cn",
    root: repository.root,
    userHome: repository.base,
  });

  assert.equal(report.intention.args.language, "zh-CN");
  assert.equal(report.observation.outputLanguage, "zh-CN");
  assert.equal(report.observation.state, "check-unavailable");
  assert.equal(report.observation.problems[0].type, "commit-unavailable");
});

test("uses the shared root-stage setup observation for every target outside Git", async () => {
  const root = await mkdtemp(join(tmpdir(), "silvermoon-check-no-git-"));
  temporaryDirectories.push(root);

  for (const options of [
    {},
    { commit: "HEAD" },
    { staged: true },
    { worktree: true },
    { remote: true },
  ]) {
    const report = await checkRepository({
      ...options,
      language: "zh-CN",
      root,
      userHome: root,
    });
    assert.equal(report.observation.state, "project-setup-required");
    assert.equal(report.observation.observedThrough, "root");
    assert.equal(report.observation.outputLanguage, "zh-CN");
    assert.equal(Object.hasOwn(report.observation, "version"), false);
    assert.match(report.observation.problems[0].summary, /^Silvermoon 发现/);
    assert.deepEqual(
      report.observation.problems.map(({ type }) => type),
      ["git-repository-missing", "config-missing", "canonical-skill-missing"],
    );
  }
});

test("returns check-unavailable when remote fetch fails", async () => {
  const repository = await fixture();
  await rm(repository.remote, { recursive: true });

  const report = await checkRepository({
    remote: true,
    root: repository.root,
    userHome: repository.base,
  });

  assert.equal(report.observation.state, "check-unavailable");
  assert.deepEqual(report.observation.version, {
    type: "remote",
    commit: null,
  });
  assert.equal(report.observation.problems[0].type, "primary-fetch-failed");
});

test("rejects conflicting programmatic check targets as usage errors", async () => {
  const repository = await fixture();

  await assert.rejects(
    checkRepository({
      remote: true,
      root: repository.root,
      staged: true,
    }),
    (error) => error.exitCode === 2,
  );
});

test("rejects an unsupported programmatic output language before Git inspection", async () => {
  const repository = await fixture();
  const commands = [];

  await assert.rejects(
    observeGitCommands(
      (args) => commands.push(args),
      () => checkRepository({
        language: "fr-FR",
        root: repository.root,
      }),
    ),
    (error) => error.exitCode === 2,
  );
  assert.deepEqual(commands, []);
});

test("validates complete guidance independently for every snapshot target", async () => {
  const repository = await fixture();
  await mkdir(join(repository.root, ...GUIDANCE_ROOT.split("/")), {
    recursive: true,
  });
  for (const phase of ["preparing", "implementing", "deploying"]) {
    await writeFile(
      join(repository.root, ...phaseGuidancePath(phase).split("/")),
      `${phase}\n`,
    );
  }
  git(repository.root, "add", ".");
  git(repository.root, "commit", "-m", "Add valid guidance");
  git(repository.root, "push", "origin", "main");

  await writeFile(
    join(repository.root, ...phaseGuidancePath("deploying").split("/")),
    Buffer.from("invalid\0guidance\n"),
  );
  const head = await checkRepository({
    root: repository.root,
    userHome: repository.base,
  });
  const worktree = await checkRepository({
    root: repository.root,
    userHome: repository.base,
    worktree: true,
  });
  git(repository.root, "add", ".");
  const staged = await checkRepository({
    root: repository.root,
    staged: true,
    userHome: repository.base,
  });
  git(repository.root, "commit", "-m", "Add invalid guidance");
  const invalidCommit = git(repository.root, "rev-parse", "HEAD");
  const committed = await checkRepository({
    commit: invalidCommit,
    root: repository.root,
    userHome: repository.base,
  });
  const current = await checkRepository({
    root: repository.root,
    userHome: repository.base,
  });
  const remote = await checkRepository({
    remote: true,
    root: repository.root,
    userHome: repository.base,
  });

  for (const report of [head, remote]) {
    assert.equal(report.observation.state, "project-ready");
    assert.deepEqual(report.observation.problems, []);
    assert.equal(Object.hasOwn(report.observation, "guidance"), false);
  }
  for (const report of [worktree, staged, committed, current]) {
    assert.equal(report.observation.state, "project-setup-required");
    assert.ok(
      report.observation.problems.some(
        ({ type }) => type === "guidance-file-nul",
      ),
    );
    assert.equal(Object.hasOwn(report.observation, "guidance"), false);
  }
  assert.notEqual(
    current.observation.version.commit,
    remote.observation.version.commit,
  );
});
