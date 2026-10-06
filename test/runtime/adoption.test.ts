import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  inspectAdoption,
  inspectNpmProject,
  REPOSITORY_SKILL_PATH,
  SILVERMOON_VERSION,
} from "../../src/foundation/skill-registration/index.ts";

const temporaryDirectories: string[] = [];
const canonicalSkill = new URL("../../skills/silvermoon", import.meta.url);

interface NpmManifestFixture {
  name: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  packageManager?: string;
  peerDependencies?: Record<string, string>;
  repository?: { url: string };
  workspaces?: string[];
}

function itemAt<T>(values: readonly (T | undefined)[], index: number): T {
  const value = values[index];
  if (value === undefined) assert.fail(`Expected item at index ${index}`);
  return value;
}

function lastItem<T>(values: readonly (T | undefined)[]): T {
  const value = values.at(-1);
  if (value === undefined) assert.fail("Expected a final item");
  return value;
}

function definedItems<T>(values: readonly (T | undefined)[]): T[] {
  return values.map((_, index) => itemAt(values, index));
}

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

async function configure(root: string) {
  await mkdir(join(root, ".silvermoon"), { recursive: true });
  await writeFile(join(root, ".silvermoon", "config.yaml"), `version: 1
primaryRepository: https://example.test/owner/repository.git
primaryBranch: main
`);
}

async function npmRepository(
  manifest: NpmManifestFixture,
  { skill = true, lockfiles = [] }: { skill?: boolean; lockfiles?: string[] } = {},
) {
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
    definedItems(report.problems).map(({ type }) => type),
    [
      "git-repository-missing",
      "config-missing",
      "canonical-skill-missing",
    ],
  );
  assert.match(itemAt(report.instructions, 0), /git .* init/);
  assert.match(itemAt(report.instructions, 1), /\.silvermoon\/config\.yaml/);
  assert.match(itemAt(report.instructions, 2), /--agent universal/);
  assert.doesNotMatch(
    definedItems(report.problems).map(({ summary }) => summary).join("\n"),
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
  assert.ok(report.config);
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

  assert.equal(lastItem(report.problems).type, "canonical-skill-mismatched");
  assert.match(lastItem(report.problems).summary, new RegExp(SILVERMOON_VERSION));
  assert.match(lastItem(report.instructions), /--agent universal/);
  assert.doesNotMatch(lastItem(report.instructions), /github-copilot/);
});

test("requires the exact root devDependency and registers npm skills from the installed package", async () => {
  const root = await npmRepository({ name: "consumer" }, { skill: false });

  const unprepared = await inspectAdoption({ root });

  assert.deepEqual(
    definedItems(unprepared.problems).map(({ type }) => type),
    ["npm-dependency-missing", "canonical-skill-missing"],
  );
  assert.match(
    itemAt(unprepared.instructions, 0),
    new RegExp(`npm install --save-dev "silvermoon@\\^${SILVERMOON_VERSION}"`),
  );
  assert.match(itemAt(unprepared.instructions, 1), /npm install/);
  assert.match(itemAt(unprepared.instructions, 1), /skills add "\.\/node_modules\/silvermoon\/skills"/);

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

test("prefers packageManager, infers a unique root lockfile, and avoids ambiguous commands", async () => {
  const explicit = await npmRepository({
    name: "consumer",
    packageManager: "pnpm@11.22.0",
    workspaces: ["packages/*"],
  }, { lockfiles: ["yarn.lock"] });
  const explicitReport = await inspectAdoption({ root: explicit });
  assert.match(itemAt(explicitReport.instructions, 0), /^From the repository root, run `pnpm add/);
  assert.match(itemAt(explicitReport.instructions, 0), /--workspace-root/);

  const inferred = await npmRepository(
    { name: "consumer" },
    { lockfiles: ["bun.lock"] },
  );
  const inferredReport = await inspectAdoption({ root: inferred });
  assert.match(itemAt(inferredReport.instructions, 0), /^From the repository root, run `bun add/);

  const managerLockfiles: [string, string][] = [
    ["npm", "package-lock.json"],
    ["pnpm", "pnpm-lock.yaml"],
    ["yarn", "yarn.lock"],
    ["bun", "bun.lockb"],
  ];
  for (const [manager, lockfile] of managerLockfiles) {
    const root = await npmRepository({ name: "consumer" }, { lockfiles: [lockfile] });
    const report = await inspectAdoption({ root });
    if (manager === "yarn") {
      assert.ok(
        itemAt(report.instructions, 0).includes(
          `npm pkg set "devDependencies.silvermoon=^${SILVERMOON_VERSION}"`,
        ),
      );
      assert.match(itemAt(report.instructions, 0), /then `yarn install`/);
    } else {
      assert.match(itemAt(report.instructions, 0), new RegExp("run `" + manager + " "));
    }
  }

  const unknown = await npmRepository({
    name: "consumer",
    packageManager: "unknown@1.0.0",
  });
  const unknownReport = await inspectAdoption({ root: unknown });
  assert.match(itemAt(unknownReport.instructions, 0), /Do not guess a package-manager command/);
  assert.doesNotMatch(itemAt(unknownReport.instructions, 0), /`(?:npm|pnpm|yarn|bun) /);

  const conflict = await npmRepository(
    { name: "consumer" },
    { lockfiles: ["pnpm-lock.yaml", "yarn.lock"] },
  );
  const conflictReport = await inspectAdoption({ root: conflict });
  assert.match(itemAt(conflictReport.instructions, 0), /Conflicting root lockfiles/);
  assert.doesNotMatch(itemAt(conflictReport.instructions, 0), /`(?:npm|pnpm|yarn|bun) /);
});

test("reports malformed manifests, wrong sections, version drift, and duplicate declarations", async () => {
  const root = await npmRepository({ name: "consumer" });
  const manifestPath = join(root, "package.json");
  await writeFile(manifestPath, "{ invalid json");

  const malformed = await inspectAdoption({ root });
  assert.equal(itemAt(malformed.problems, 0).type, "npm-manifest-invalid");

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
    definedItems(declarations.problems).map(({ type }) => type),
    ["npm-dependency-version-mismatch", "npm-dependency-duplicate"],
  );
  assert.match(itemAt(declarations.problems, 1).summary, /dependencies, devDependencies, peerDependencies/);
});

test("reports unreadable and non-regular root manifests without hiding the failure", async () => {
  const root = await npmRepository({ name: "consumer" });
  const unreadable = await inspectNpmProject(root, root, {
    readManifest: async () => {
      throw Object.assign(new Error("permission denied"), { code: "EACCES" });
    },
  });
  assert.equal(itemAt(unreadable.findings, 0).problem.type, "npm-manifest-unreadable");
  assert.match(itemAt(unreadable.findings, 0).problem.summary, /permission denied/);

  const manifestPath = join(root, "package.json");
  await rm(manifestPath);
  await mkdir(manifestPath);
  const nonRegular = await inspectAdoption({ root });
  assert.equal(itemAt(nonRegular.problems, 0).type, "npm-manifest-invalid");
  assert.match(itemAt(nonRegular.problems, 0).summary, /regular file/);
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
  assert.deepEqual(source.problems, []);
});

test("source snapshots remain exempt without a self-dependency or matching version", async () => {
  const sourceRoot = fileURLToPath(new URL("../..", import.meta.url));
  const snapshotRoot = await temporaryDirectory();
  const manifest = JSON.parse(await readFile(join(sourceRoot, "package.json"), "utf8"));
  manifest.version = "0.0.0";
  delete manifest.devDependencies.silvermoon;
  await writeFile(join(snapshotRoot, "package.json"), JSON.stringify(manifest));

  const snapshot = await inspectNpmProject(snapshotRoot, sourceRoot);
  assert.equal(snapshot.sourceCheckout, true);
  assert.deepEqual(snapshot.findings, []);

  manifest.devDependencies.silvermoon = "^0.0.0";
  await writeFile(join(snapshotRoot, "package.json"), JSON.stringify(manifest));
  const historical = await inspectNpmProject(snapshotRoot, sourceRoot);
  assert.deepEqual(historical.findings, []);
});

test("source runtime identity follows the physical checkout, not path spelling", async () => {
  const sourceRoot = fileURLToPath(new URL("../..", import.meta.url));
  const directory = await temporaryDirectory();
  const alias = join(directory, "runtime-alias");
  await symlink(sourceRoot, alias, "junction");
  try {
    const source = await inspectNpmProject(sourceRoot, alias);
    assert.equal(source.sourceCheckout, true);
    assert.deepEqual(source.findings, []);
  } finally {
    await unlink(alias);
  }
});

test("another runtime directs source projects to their checkout, never a self-dependency", async () => {
  const sourceRoot = fileURLToPath(new URL("../..", import.meta.url));
  const manifest = JSON.parse(await readFile(join(sourceRoot, "package.json"), "utf8"));
  for (const repositoryUrl of [
    "git+https://github.com/shazhou-ww/silvermoon.git",
    "https://github.com/shazhou-ww/silvermoon",
  ]) {
    manifest.repository.url = repositoryUrl;
    const root = await npmRepository(manifest, { skill: false });
    const report = await inspectAdoption({ root });
    assert.deepEqual(definedItems(report.problems).map(({ type }) => type), [
      "source-checkout-runtime-required",
      "canonical-skill-missing",
    ]);
    assert.match(itemAt(report.instructions, 0), /same command and options.*node bin\/silvermoon\.js/);
    assert.match(itemAt(report.instructions, 1), /pnpm sync:skills/);
    assert.doesNotMatch(report.instructions.join("\n"), /node_modules|add --save-dev|npx skills/);
  }
});

test("package name or repository URL alone does not exempt consumers", async () => {
  for (const manifest of [
    { name: "silvermoon" },
    { name: "silvermoon", repository: { url: "https://example.com/silvermoon.git" } },
    { name: "consumer", repository: { url: "https://github.com/shazhou-ww/silvermoon" } },
  ]) {
    const root = await npmRepository(manifest);
    const report = await inspectAdoption({ root });
    assert.deepEqual(definedItems(report.problems).map(({ type }) => type), ["npm-dependency-missing"]);
  }
});
