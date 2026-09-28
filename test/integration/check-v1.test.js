import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, test } from "node:test";

import { observeGitCommands } from "../../src/git.js";
import { checkRepository } from "../../src/index.js";
import { ideaPaths } from "../../src/layout.js";
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
    "intention",
    "observation",
  ]);
  assert.deepEqual(report.intention, {
    command: "check",
    args: { target: { type: "head" } },
  });
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
  assert.deepEqual(Object.keys(report).sort(), ["intention", "observation"]);
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
      remote: true,
      root: repository.root,
      userHome: repository.base,
    }),
  );

  assert.equal(report.observation.state, "project-setup-required");
  assert.equal(report.observation.observedThrough, "version");
  assert.deepEqual(report.observation.version, { type: "remote", commit: null });
  assert.equal(report.observation.problems[0].type, "config-invalid-primary-repository");
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
  assert.deepEqual(Object.keys(report).sort(), ["intention", "observation"]);
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
      root,
      userHome: root,
    });
    assert.equal(report.observation.state, "project-setup-required");
    assert.equal(report.observation.observedThrough, "root");
    assert.equal(Object.hasOwn(report.observation, "version"), false);
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
