import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { inspectNpmTarball } from "./npm-tarball.mjs";

const packageRoot = fileURLToPath(new URL("..", import.meta.url));
const configuredTarball = process.env.SILVERMOON_TARBALL?.trim();
const expectedSha256 = process.env.SILVERMOON_TARBALL_SHA256?.trim();
const expectedIntegrity = process.env.SILVERMOON_TARBALL_INTEGRITY?.trim();
const expectedGitHead = process.env.SILVERMOON_RELEASE_COMMIT?.trim();
const tarball = configuredTarball
  ? resolve(packageRoot, configuredTarball)
  : null;
if (tarball && (!existsSync(tarball) || !statSync(tarball).isFile())) {
  process.stderr.write(`Configured npm tarball is not a file: ${tarball}\n`);
  process.exit(1);
}
if (!tarball && (expectedSha256 || expectedIntegrity)) {
  process.stderr.write(
    "Tarball identity was configured without SILVERMOON_TARBALL.\n",
  );
  process.exit(1);
}
if (expectedGitHead && !/^[0-9a-f]{40,64}$/i.test(expectedGitHead)) {
  process.stderr.write(
    "SILVERMOON_RELEASE_COMMIT must be a full hexadecimal Git object ID.\n",
  );
  process.exit(1);
}
if (expectedGitHead && !tarball) {
  process.stderr.write(
    "Release commit was configured without SILVERMOON_TARBALL.\n",
  );
  process.exit(1);
}
if (tarball && expectedSha256) {
  const actualSha256 = createHash("sha256")
    .update(readFileSync(tarball))
    .digest("hex");
  if (actualSha256 !== expectedSha256) {
    process.stderr.write(
      `Configured npm tarball SHA-256 mismatch: expected ${expectedSha256}, calculated ${actualSha256}.\n`,
    );
    process.exit(1);
  }
}

const npmArguments = [
  "pack",
  ...(tarball ? [tarball] : []),
  "--dry-run",
  "--json",
];
const configuredNpmCli = process.env.npm_execpath;
const npmCli =
  configuredNpmCli && /^npm-cli\.js$/i.test(basename(configuredNpmCli))
    ? configuredNpmCli
    : resolve(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");
const command = process.platform === "win32" ? process.execPath : "npm";
const args = process.platform === "win32"
  ? [npmCli, ...npmArguments]
  : npmArguments;
const packed = spawnSync(command, args, {
  cwd: packageRoot,
  encoding: "utf8",
  windowsHide: true,
});

if (packed.status !== 0) {
  process.stderr.write(
    packed.stderr || packed.error?.message || "npm pack --dry-run failed\n",
  );
  process.exitCode = packed.status ?? 1;
} else {
  const result = JSON.parse(packed.stdout)[0];
  const files = result.files.map(({ path }) => path).sort();
  const expected = [
    "README.md",
    "README.zh-CN.md",
    "assets/silvermoon-avatar.svg",
    "assets/silvermoon-mascot.png",
    "assets/silvermoon.svg",
    "bin/silvermoon.js",
    "docs/assets/silvermoon-avatar.svg",
    "docs/core-concepts.md",
    "docs/getting-started.md",
    "docs/maintaining.md",
    "docs/npm-package-releases.md",
    "docs/operations.md",
    "docs/reference.md",
    "docs/repository-tasks.md",
    "package.json",
    "schema/v1/command-report.schema.json",
    "schema/v1/config.schema.json",
    "schema/v1/definitions.schema.json",
    "schema/v1/domain-message.schema.json",
    "schema/v1/idea-status.schema.json",
    "schema/v1/user-config.schema.json",
    "schema/v2/trace-event.schema.json",
    "skills/silvermoon/SKILL.md",
    "skills/silvermoon/references/adoption.md",
    "src/adoption.js",
    "src/cli.js",
    "src/config.js",
    "src/create-idea.js",
    "src/dialogue.js",
    "src/domain.js",
    "src/git.js",
    "src/guidance.js",
    "src/idea-query.js",
    "src/idea-layout.js",
    "src/idea-templates.js",
    "src/ideas.js",
    "src/index.js",
    "src/layout.js",
    "src/language.js",
    "src/list-ideas.js",
    "src/observation.js",
    "src/repository.js",
    "src/response.js",
    "src/trace.js",
    "src/user-config.js",
    "src/whatsnext.js",
    "src/yaml.js",
  ].sort();
  const missing = expected.filter((path) => !files.includes(path));
  const unexpected = files.filter((path) => !expected.includes(path));

  const emptyReadme = result.files.find(
    ({ path, size }) => path === "README.md" && !(size > 0),
  );
  const integrityMismatch =
    expectedIntegrity && result.integrity !== expectedIntegrity;
  let actualGitHead;
  let readmeMetadataMismatch = false;
  if (expectedGitHead) {
    try {
      const inspected = await inspectNpmTarball(tarball);
      actualGitHead = inspected.manifest.gitHead;
      readmeMetadataMismatch =
        inspected.manifest.readmeFilename !== "README.md" ||
        inspected.manifest.readme !==
          inspected.entries.get("README.md")?.toString("utf8");
    } catch (error) {
      process.stderr.write(`Could not inspect configured npm tarball: ${error.message}\n`);
      process.exit(1);
    }
  }
  const gitHeadMismatch =
    expectedGitHead && actualGitHead !== expectedGitHead;
  let directoryPackMismatch = false;
  if (expectedGitHead) {
    const comparisonDirectory = await mkdtemp(
      join(tmpdir(), "silvermoon-pack-compare-"),
    );
    try {
      const comparisonArguments = [
        "pack",
        "--json",
        "--pack-destination",
        comparisonDirectory,
      ];
      const comparison = spawnSync(
        command,
        process.platform === "win32"
          ? [npmCli, ...comparisonArguments]
          : comparisonArguments,
        {
          cwd: packageRoot,
          encoding: "utf8",
          windowsHide: true,
        },
      );
      if (comparison.status !== 0) {
        process.stderr.write(
          comparison.stderr ||
            comparison.error?.message ||
            "Deterministic npm directory pack failed.\n",
        );
        process.exit(1);
      }
      const comparisonResults = JSON.parse(comparison.stdout);
      const comparisonFilename = comparisonResults?.[0]?.filename;
      if (
        comparisonResults.length !== 1 ||
        typeof comparisonFilename !== "string" ||
        basename(comparisonFilename) !== comparisonFilename
      ) {
        process.stderr.write(
          "Deterministic npm directory pack returned invalid metadata.\n",
        );
        process.exit(1);
      }
      const [candidateBytes, comparisonBytes] = await Promise.all([
        readFile(tarball),
        readFile(resolve(comparisonDirectory, comparisonFilename)),
      ]);
      directoryPackMismatch = !candidateBytes.equals(comparisonBytes);
    } finally {
      await rm(comparisonDirectory, { force: true, recursive: true });
    }
  }

  if (
    missing.length > 0 ||
    unexpected.length > 0 ||
    emptyReadme ||
    integrityMismatch ||
    gitHeadMismatch ||
    readmeMetadataMismatch ||
    directoryPackMismatch
  ) {
    if (missing.length > 0) process.stderr.write(`Missing packed files: ${missing.join(", ")}\n`);
    if (unexpected.length > 0) {
      process.stderr.write(`Unexpected packed files: ${unexpected.join(", ")}\n`);
    }
    if (emptyReadme) {
      process.stderr.write("Packed README.md is empty; the release README generation is broken.\n");
    }
    if (integrityMismatch) {
      process.stderr.write(
        `Configured npm tarball integrity mismatch: expected ${expectedIntegrity}, found ${result.integrity}.\n`,
      );
    }
    if (gitHeadMismatch) {
      process.stderr.write(
        `Configured npm tarball gitHead mismatch: expected ${expectedGitHead}, found ${actualGitHead ?? "missing"}.\n`,
      );
    }
    if (readmeMetadataMismatch) {
      process.stderr.write(
        "Configured npm tarball package README metadata does not match README.md.\n",
      );
    }
    if (directoryPackMismatch) {
      process.stderr.write(
        "Configured npm tarball does not match a deterministic directory pack.\n",
      );
    }
    process.exitCode = 1;
  } else {
    process.stdout.write(
      `PACK_OK name=${result.name} version=${result.version} files=${files.length} source=${tarball ?? "directory-dry-run"} integrity=${result.integrity}${expectedGitHead ? ` gitHead=${actualGitHead}` : ""}\n`,
    );
  }
}
