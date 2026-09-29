import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "node:test";

import {
  inspectAdoption,
  REPOSITORY_SKILL_PATH,
  SILVERMOON_VERSION,
} from "../../src/adoption.js";

const temporaryDirectories = [];
const canonicalSkill = new URL("../../skills/silvermoon", import.meta.url);

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

async function configure(root) {
  await mkdir(join(root, ".silvermoon"), { recursive: true });
  await writeFile(join(root, ".silvermoon", "config.yaml"), `version: 1
primaryRepository: https://example.test/owner/repository.git
primaryBranch: main
`);
}

test("reports all independently observable setup problems in priority order", async () => {
  const root = await temporaryDirectory();

  const report = await inspectAdoption({ root });

  assert.equal(report.gitReady, false);
  assert.equal(report.config, null);
  assert.deepEqual(
    report.problems.map(({ type }) => type),
    [
      "git-repository-missing",
      "config-missing",
      "canonical-skill-missing",
    ],
  );
  assert.match(report.instructions[0], /git .* init/);
  assert.match(report.instructions[1], /\.silvermoon\/config\.yaml/);
  assert.match(report.instructions[2], /--agent universal/);
  assert.doesNotMatch(
    report.problems.map(({ summary }) => summary).join("\n"),
    /Run `git|Create \.silvermoon|npx skills add/,
  );
});

test("accepts an ecosystem-neutral Git repository with canonical configuration and skill", async () => {
  const root = await temporaryDirectory();
  const initialized = spawnSync(
    "git",
    ["-C", root, "init", "--initial-branch=main"],
    { encoding: "utf8", windowsHide: true },
  );
  assert.equal(initialized.status, 0, initialized.stderr);
  await configure(root);
  await cp(
    canonicalSkill,
    join(root, ...REPOSITORY_SKILL_PATH.split("/")),
    { recursive: true },
  );

  const report = await inspectAdoption({ root });

  assert.deepEqual(report.problems, []);
  assert.deepEqual(report.instructions, []);
  assert.equal(report.config.version, 1);
  await assert.rejects(readFile(join(root, "package.json")), { code: "ENOENT" });
  await assert.rejects(readFile(join(root, "node_modules")), { code: "ENOENT" });
});

test("accepts canonical skill text across CRLF and LF checkouts", async () => {
  const root = await temporaryDirectory();
  const initialized = spawnSync(
    "git",
    ["-C", root, "init", "--initial-branch=main"],
    { encoding: "utf8", windowsHide: true },
  );
  assert.equal(initialized.status, 0, initialized.stderr);
  await configure(root);
  const skillRoot = join(root, ...REPOSITORY_SKILL_PATH.split("/"));
  await cp(canonicalSkill, skillRoot, { recursive: true });
  const skillPath = join(skillRoot, "SKILL.md");
  const source = await readFile(skillPath, "utf8");
  const lf = source.replaceAll("\r\n", "\n");
  await writeFile(
    skillPath,
    source.includes("\r\n") ? lf : lf.replaceAll("\n", "\r\n"),
  );

  const report = await inspectAdoption({ root });

  assert.deepEqual(report.problems, []);
  assert.deepEqual(report.instructions, []);
});

test("reports canonical skill drift against the running package", async () => {
  const root = await temporaryDirectory();
  const initialized = spawnSync(
    "git",
    ["-C", root, "init", "--initial-branch=main"],
    { encoding: "utf8", windowsHide: true },
  );
  assert.equal(initialized.status, 0, initialized.stderr);
  await configure(root);
  const skillRoot = join(root, ...REPOSITORY_SKILL_PATH.split("/"));
  await cp(canonicalSkill, skillRoot, { recursive: true });
  await writeFile(join(skillRoot, "SKILL.md"), "changed\n");

  const report = await inspectAdoption({ root });

  assert.equal(report.problems.at(-1).type, "canonical-skill-mismatched");
  assert.match(report.problems.at(-1).summary, new RegExp(SILVERMOON_VERSION));
  assert.match(report.instructions.at(-1), /--agent universal/);
  assert.doesNotMatch(report.instructions.at(-1), /github-copilot/);
});
