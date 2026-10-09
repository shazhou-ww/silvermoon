import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "node:test";
import { spawnSync } from "node:child_process";

import {
  inspectAdoption,
  SILVERMOON_VERSION,
} from "../../src/foundation/skill-registration/index.ts";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true })
    ),
  );
});

async function temporaryDirectory() {
  const root = await mkdtemp(join(tmpdir(), "silvermoon-adoption-"));
  temporaryDirectories.push(root);
  return root;
}

function initializeGit(root: string) {
  const initialized = spawnSync(
    "git",
    ["-C", root, "init", "--initial-branch=main"],
    { encoding: "utf8", windowsHide: true },
  );
  assert.equal(initialized.status, 0, initialized.stderr);
}

async function configure(root: string, version = 1) {
  await mkdir(join(root, ".silvermoon"), { recursive: true });
  await writeFile(join(root, ".silvermoon", "config.yaml"), `version: ${version}
primaryRepository: https://example.test/owner/repository.git
primaryBranch: main
`);
}

test("reports only Git and Silvermoon configuration readiness", async () => {
  const root = await temporaryDirectory();

  const report = await inspectAdoption({ root });

  assert.equal(report.gitReady, false);
  assert.equal(report.config, null);
  assert.deepEqual(
    report.problems.map(({ type }) => type),
    ["git-repository-missing", "config-missing"],
  );
  assert.match(report.instructions[0] ?? "", /git .* init/);
  assert.match(report.instructions[1] ?? "", /\.silvermoon\/config\.yaml/);
});

test("accepts projects without package metadata or a repository skill", async () => {
  const root = await temporaryDirectory();
  initializeGit(root);
  await configure(root);

  const report = await inspectAdoption({ root });

  assert.deepEqual(report.problems, []);
  assert.deepEqual(report.instructions, []);
  assert.equal(report.config?.version, 1);
  assert.match(SILVERMOON_VERSION, /^\d+\.\d+\.\d+/);
});

test("ignores project package and skill paths regardless of their contents", async () => {
  const root = await temporaryDirectory();
  initializeGit(root);
  await configure(root);
  await mkdir(join(root, "package.json"));
  const skillRoot = join(root, ".agents", "skills", "silvermoon");
  await mkdir(skillRoot, { recursive: true });
  await writeFile(join(skillRoot, "SKILL.md"), "project-owned drift\n");

  const report = await inspectAdoption({ root });

  assert.deepEqual(report.problems, []);
  assert.deepEqual(report.instructions, []);
});

test("validates configuration from the selected snapshot root", async () => {
  const repositoryRoot = await temporaryDirectory();
  initializeGit(repositoryRoot);
  await configure(repositoryRoot);
  const snapshotRoot = await temporaryDirectory();
  await configure(snapshotRoot, 3);

  const report = await inspectAdoption({
    contentRoot: snapshotRoot,
    repositoryRoot,
    root: repositoryRoot,
  });

  assert.equal(report.gitReady, true);
  assert.equal(report.config, null);
  assert.equal(report.problems[0]?.type, "config-unsupported-version");
});
