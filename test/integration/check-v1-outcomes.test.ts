import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, test } from "node:test";

import { observeGitCommands } from "../../src/foundation/git/index.ts";
import { checkRepository } from "../../src/index.ts";
import { withTraceFile } from "../../src/foundation/trace/index.ts";
import { serializeIdeaStatus } from "../../src/foundation/idea-model/index.ts";
import {
  GUIDANCE_ROOT,
  ideaPaths,
  phaseGuidancePath,
} from "../../src/foundation/coordinates/index.ts";
import {
  FIRST_ID,
  git,
} from "../helpers/repository.ts";
import { createCheckV1TestHelpers } from "../helpers/check-v1.ts";

const { fixture, trackTemporaryDirectory } = createCheckV1TestHelpers(afterEach);

test("valid remote snapshot is not blocked by an unrelated local skill path", async () => {
  const repository = await fixture({ withRemote: true });
  const skill = join(repository.root, ".agents", "skills", "silvermoon");
  await mkdir(join(repository.root, ".agents", "skills"), { recursive: true });
  await writeFile(skill, "local-only skill\n");
  git(repository.root, "add", "--all");
  git(repository.root, "commit", "-m", "Add local skill");

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

test("remote bootstrap reads config directly and opens only the primary snapshot", async () => {
  const repository = await fixture({ withRemote: true });
  const tracePath = join(repository.base, "remote-check.trace.jsonl");

  const report = await withTraceFile(
    tracePath,
    "test.remote-check",
    {},
    () => checkRepository({
      remote: true,
      root: repository.root,
      userHome: repository.base,
    }),
  );

  assert.equal(report.observation.state, "project-ready");
  const events = (await readFile(tracePath, "utf8"))
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  assert.equal(
    events.some(({ name }) => name === "snapshot.materialize"),
    false,
  );
  assert.equal(
    events.filter(({ event, name }) =>
      event === "span-start" && name === "snapshot.open"
    ).length,
    1,
  );
  assert.equal(
    events.some(({ name }) => name === "snapshot.materialize-bounded"),
    false,
  );
});

test("direct snapshot checks preserve Git symlink modes", async () => {
  const repository = await fixture();
  const paths = ideaPaths(FIRST_ID);
  const target = join(repository.root, "symlink-target.txt");
  await writeFile(target, "target.txt\n");
  const blob = git(repository.root, "hash-object", "-w", "symlink-target.txt");
  const linkPath = `${paths.outerPath}/support-link.md`;
  git(
    repository.root,
    "update-index",
    "--add",
    "--cacheinfo",
    `120000,${blob},${linkPath}`,
  );
  git(repository.root, "commit", "-m", "Add world symlink entry");

  const report = await checkRepository({
    root: repository.root,
    userHome: repository.base,
  });

  assert.equal(report.observation.state, "project-setup-required");
  assert.ok(
    report.observation.problems.some(
      ({ type }: { type: string }) => type === "idea-world-symlink",
    ),
  );

  const configRepository = await fixture();
  const configTarget = join(configRepository.root, "config-target.txt");
  await writeFile(configTarget, "config.yaml\n");
  const configBlob = git(
    configRepository.root,
    "hash-object",
    "-w",
    "config-target.txt",
  );
  git(
    configRepository.root,
    "update-index",
    "--add",
    "--cacheinfo",
    `120000,${configBlob},.silvermoon/config.yaml`,
  );
  git(configRepository.root, "commit", "-m", "Add config symlink entry");

  const invalidConfig = await checkRepository({
    root: configRepository.root,
    userHome: configRepository.base,
  });
  assert.equal(invalidConfig.observation.state, "project-setup-required");
  assert.equal(
    invalidConfig.observation.problems.at(0)?.type,
    "config-invalid-file",
  );
});

test("remote check reports invalid HEAD primary coordinates before fetching", async () => {
  const repository = await fixture();
  await writeFile(
    join(repository.root, ".silvermoon", "config.yaml"),
    "version: 1\nprimaryRepository: invalid\nprimaryBranch: main\n",
  );
  git(repository.root, "add", "--all");
  git(repository.root, "commit", "-m", "Break local primary coordinates");
  const commands: (readonly string[])[] = [];

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
  assert.equal(
    report.observation.problems.at(0)?.type,
    "config-invalid-primary-repository",
  );
  assert.match(report.observation.problems.at(0)?.summary ?? "", /^在 /);
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
  assert.equal(report.observation.problems.at(0)?.type, "commit-unavailable");
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
  assert.equal(report.observation.problems.at(0)?.type, "commit-unavailable");
});

test("uses the shared root-stage setup observation for every target outside Git", async () => {
  const root = await mkdtemp(join(tmpdir(), "silvermoon-check-no-git-"));
  trackTemporaryDirectory(root);

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
    assert.match(
      report.observation.problems.at(0)?.summary ?? "",
      /^Silvermoon 发现/,
    );
    assert.deepEqual(
      report.observation.problems.map(({ type }: { type: string }) => type),
      ["git-repository-missing", "config-missing"],
    );
  }
});

test("returns check-unavailable when remote fetch fails", async () => {
  const repository = await fixture({ withRemote: true });
  assert.ok(repository.remote);
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
  assert.equal(report.observation.problems.at(0)?.type, "primary-fetch-failed");
});

test("rejects conflicting programmatic check targets as usage errors", async () => {
  const repository = await fixture();

  await assert.rejects(
    checkRepository({
      remote: true,
      root: repository.root,
      staged: true,
    }),
    (error) =>
      error instanceof Error
      && "exitCode" in error
      && error.exitCode === 2,
  );
});

test("rejects an unsupported programmatic output language before Git inspection", async () => {
  const repository = await fixture();
  const commands: (readonly string[])[] = [];

  await assert.rejects(
    observeGitCommands(
      (args) => commands.push(args),
      () => checkRepository({
        language: "fr-FR",
        root: repository.root,
      }),
    ),
    (error) =>
      error instanceof Error
      && "exitCode" in error
      && error.exitCode === 2,
  );
  assert.deepEqual(commands, []);
});

test("validates complete guidance independently for every snapshot target", async () => {
  const repository = await fixture({ withRemote: true });
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
        ({ type }: { type: string }) => type === "guidance-file-nul",
      ),
    );
    assert.equal(Object.hasOwn(report.observation, "guidance"), false);
  }
  assert.notEqual(
    current.observation.version?.commit,
    remote.observation.version?.commit,
  );
});
