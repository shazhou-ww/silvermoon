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
import { fileURLToPath } from "node:url";

import {
  dependencyInstallCommand,
  inspectAdoption,
  inspectNpmProject,
  REPOSITORY_SKILL_PATH,
  renderDependencyCommand,
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

async function npmRepository(manifest, { skill = true, lockfiles = [] } = {}) {
  const root = await temporaryDirectory();
  const initialized = spawnSync(
    "git",
    ["-C", root, "init", "--initial-branch=main"],
    { encoding: "utf8", windowsHide: true },
  );
  assert.equal(initialized.status, 0, initialized.stderr);
  await configure(root);
  await writeFile(join(root, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  for (const filename of lockfiles) {
    await writeFile(join(root, filename), "");
  }
  if (skill) {
    await cp(
      canonicalSkill,
      join(root, ...REPOSITORY_SKILL_PATH.split("/")),
      { recursive: true },
    );
  }
  return root;
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

test("requires the exact root devDependency and registers npm skills from the installed package", async () => {
  const root = await npmRepository({ name: "consumer" }, { skill: false });

  const unprepared = await inspectAdoption({ root });

  assert.deepEqual(
    unprepared.problems.map(({ type }) => type),
    ["npm-dependency-missing", "canonical-skill-missing"],
  );
  assert.match(
    unprepared.instructions[0],
    new RegExp(`npm install --save-dev "silvermoon@\\^${SILVERMOON_VERSION}"`),
  );
  assert.match(unprepared.instructions[1], /npm install/);
  assert.match(unprepared.instructions[1], /skills add "\.\/node_modules\/silvermoon\/skills"/);

  await writeFile(
    join(root, "package.json"),
    `${JSON.stringify({
      name: "consumer",
      devDependencies: { silvermoon: `^${SILVERMOON_VERSION}` },
    }, null, 2)}\n`,
  );
  await cp(
    canonicalSkill,
    join(root, ...REPOSITORY_SKILL_PATH.split("/")),
    { recursive: true },
  );
  const prepared = await inspectAdoption({ root });

  assert.deepEqual(prepared.problems, []);
  await assert.rejects(readFile(join(root, "node_modules")), { code: "ENOENT" });
});

test("generates structured manager-specific root dependency commands", () => {
  assert.deepEqual(
    dependencyInstallCommand("npm", false),
    {
      executable: "npm",
      args: ["install", "--save-dev", `silvermoon@^${SILVERMOON_VERSION}`],
    },
  );
  assert.deepEqual(
    dependencyInstallCommand("pnpm", true),
    {
      executable: "pnpm",
      args: ["add", "--save-dev", `silvermoon@^${SILVERMOON_VERSION}`, "--workspace-root"],
    },
  );
  assert.deepEqual(
    dependencyInstallCommand("yarn", true),
    {
      executable: "yarn",
      args: [
        "add",
        `silvermoon@^${SILVERMOON_VERSION}`,
        "--dev",
        "--ignore-workspace-root-check",
      ],
    },
  );
  assert.deepEqual(
    dependencyInstallCommand("bun", true),
    {
      executable: "bun",
      args: ["add", `silvermoon@^${SILVERMOON_VERSION}`, "--dev"],
    },
  );
  assert.equal(dependencyInstallCommand("unknown", false), null);
});

test("renders caret ranges with portable quoting for Windows and Unix shells", () => {
  const rendered = `npm install --save-dev "silvermoon@^${SILVERMOON_VERSION}"`;
  assert.equal(renderDependencyCommand("npm", false), rendered);
  assert.equal(renderDependencyCommand("unknown", false), null);
});

test("prefers packageManager, infers a unique root lockfile, and avoids ambiguous commands", async () => {
  const explicit = await npmRepository({
    name: "consumer",
    packageManager: "pnpm@11.22.0",
    workspaces: ["packages/*"],
  }, { lockfiles: ["yarn.lock"] });
  const explicitReport = await inspectAdoption({ root: explicit });
  assert.match(explicitReport.instructions[0], /^From the repository root, run `pnpm add/);
  assert.match(explicitReport.instructions[0], /--workspace-root/);

  const inferred = await npmRepository(
    { name: "consumer" },
    { lockfiles: ["bun.lock"] },
  );
  const inferredReport = await inspectAdoption({ root: inferred });
  assert.match(inferredReport.instructions[0], /^From the repository root, run `bun add/);

  for (const [manager, lockfile] of [
    ["npm", "package-lock.json"],
    ["pnpm", "pnpm-lock.yaml"],
    ["yarn", "yarn.lock"],
    ["bun", "bun.lockb"],
  ]) {
    const root = await npmRepository({ name: "consumer" }, { lockfiles: [lockfile] });
    const report = await inspectAdoption({ root });
    assert.match(report.instructions[0], new RegExp("run `" + manager + " "));
  }

  const unknown = await npmRepository({
    name: "consumer",
    packageManager: "unknown@1.0.0",
  });
  const unknownReport = await inspectAdoption({ root: unknown });
  assert.match(unknownReport.instructions[0], /Do not guess a package-manager command/);
  assert.doesNotMatch(unknownReport.instructions[0], /`(?:npm|pnpm|yarn|bun) /);

  const conflict = await npmRepository(
    { name: "consumer" },
    { lockfiles: ["pnpm-lock.yaml", "yarn.lock"] },
  );
  const conflictReport = await inspectAdoption({ root: conflict });
  assert.match(conflictReport.instructions[0], /Conflicting root lockfiles/);
  assert.doesNotMatch(conflictReport.instructions[0], /`(?:npm|pnpm|yarn|bun) /);
});

test("reports malformed manifests, wrong sections, version drift, and duplicate declarations", async () => {
  const root = await npmRepository({ name: "consumer" });
  const manifestPath = join(root, "package.json");
  await writeFile(manifestPath, "{ invalid json");

  const malformed = await inspectAdoption({ root });
  assert.equal(malformed.problems[0].type, "npm-manifest-invalid");

  await writeFile(
    manifestPath,
    `${JSON.stringify({
      name: "consumer",
      dependencies: { silvermoon: `^${SILVERMOON_VERSION}` },
      devDependencies: { silvermoon: "^0.0.1" },
      peerDependencies: { silvermoon: "^0.0.1" },
    }, null, 2)}\n`,
  );
  const declarations = await inspectAdoption({ root });
  assert.deepEqual(
    declarations.problems.map(({ type }) => type),
    ["npm-dependency-version-mismatch", "npm-dependency-duplicate"],
  );
  assert.match(declarations.problems[1].summary, /dependencies, devDependencies, peerDependencies/);
});

test("reports unreadable and non-regular root manifests without hiding the failure", async () => {
  const root = await npmRepository({ name: "consumer" });
  const unreadable = await inspectNpmProject(root, root, {
    readManifest: async () => {
      throw Object.assign(new Error("permission denied"), { code: "EACCES" });
    },
  });
  assert.equal(unreadable.findings[0].problem.type, "npm-manifest-unreadable");
  assert.match(unreadable.findings[0].problem.summary, /permission denied/);

  const manifestPath = join(root, "package.json");
  await rm(manifestPath);
  await mkdir(manifestPath);
  const nonRegular = await inspectAdoption({ root });
  assert.equal(nonRegular.problems[0].type, "npm-manifest-invalid");
  assert.match(nonRegular.problems[0].summary, /regular file/);
});

test("classifies npm projects from the root manifest only and exempts the source checkout", async () => {
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
  await mkdir(join(root, "packages", "nested"), { recursive: true });
  await writeFile(join(root, "packages", "nested", "package.json"), "{}\n");
  await writeFile(join(root, "pnpm-lock.yaml"), "");

  const nonNpm = await inspectAdoption({ root });
  assert.deepEqual(nonNpm.problems, []);

  const sourceRoot = fileURLToPath(new URL("../..", import.meta.url));
  const source = await inspectAdoption({ root: sourceRoot });
  assert.equal(
    source.problems.some(({ type }) => type.startsWith("npm-dependency-")),
    false,
  );
});
