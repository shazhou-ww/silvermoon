import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test, { afterEach } from "node:test";

import { formatGitHubOutput } from "../../scripts/build-npm-tarball.mjs";
import { inspectNpmTarball } from "../../scripts/verify-npm-release.mjs";

const temporaryDirectories = [];
const builderPath = resolve("scripts/build-npm-tarball.mjs");
const gitHead = "a".repeat(40);

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { force: true, recursive: true }),
    ),
  );
});

test("builds one tarball and records its verified identity and files", async () => {
  const root = await mkdtemp(join(tmpdir(), "npm-tarball-build-"));
  temporaryDirectories.push(root);
  const packageDirectory = join(root, "package");
  const outputDirectory = join(root, "output");
  const githubOutput = join(root, "github-output");
  await mkdir(packageDirectory, { recursive: true });
  await writeFile(
    join(packageDirectory, "package.json"),
    `${JSON.stringify({
      name: "tarball-build-fixture",
      version: "1.2.3",
      files: ["index.js"],
    }, null, 2)}\n`,
  );
  await writeFile(join(packageDirectory, "index.js"), "export const value = 1;\n");

  const built = spawnSync(process.execPath, [
    builderPath,
    "--package-directory",
    packageDirectory,
    "--output-directory",
    outputDirectory,
    "--git-head",
    gitHead,
  ], {
    encoding: "utf8",
    env: { ...process.env, GITHUB_OUTPUT: githubOutput },
    windowsHide: true,
  });
  assert.equal(built.status, 0, built.stderr || built.error?.message);
  const metadata = JSON.parse(built.stdout);
  const tarballs = (await readdir(outputDirectory)).filter((path) =>
    path.endsWith(".tgz")
  );
  const bytes = await readFile(metadata.tarballPath);

  assert.deepEqual(tarballs, ["tarball-build-fixture-1.2.3.tgz"]);
  assert.equal(metadata.name, "tarball-build-fixture");
  assert.equal(metadata.version, "1.2.3");
  assert.equal(metadata.gitHead, gitHead);
  assert.equal(
    metadata.sha256,
    createHash("sha256").update(bytes).digest("hex"),
  );
  assert.equal(
    metadata.integrity,
    `sha512-${createHash("sha512").update(bytes).digest("base64")}`,
  );
  assert.deepEqual(
    metadata.files.map(({ path }) => path),
    ["index.js", "package.json"],
  );
  assert.equal(
    (await inspectNpmTarball(metadata.tarballPath)).manifest.gitHead,
    gitHead,
  );
  assert.equal(
    await readFile(githubOutput, "utf8"),
    `${formatGitHubOutput(metadata)}\n`,
  );
});

test("rejects a missing or conflicting release git head", async () => {
  const root = await mkdtemp(join(tmpdir(), "npm-tarball-build-invalid-"));
  temporaryDirectories.push(root);
  const packageDirectory = join(root, "package");
  const outputDirectory = join(root, "output");
  await mkdir(packageDirectory, { recursive: true });
  await writeFile(
    join(packageDirectory, "package.json"),
    `${JSON.stringify({
      name: "tarball-build-fixture",
      version: "1.2.3",
      gitHead: "b".repeat(40),
    }, null, 2)}\n`,
  );

  for (const args of [
    [
      "--package-directory",
      packageDirectory,
      "--output-directory",
      outputDirectory,
    ],
    [
      "--package-directory",
      packageDirectory,
      "--output-directory",
      outputDirectory,
      "--git-head",
      gitHead,
    ],
  ]) {
    const built = spawnSync(process.execPath, [builderPath, ...args], {
      encoding: "utf8",
      windowsHide: true,
    });
    assert.equal(built.status, 1);
  }
});
