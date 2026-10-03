import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { inspectNpmTarball } from "./npm-tarball.mjs";
import { npmCommand } from "./npm-command.mjs";

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
const { command, args } = npmCommand(npmArguments);
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
    "LICENSE",
    "README.md",
    "README.zh-CN.md",
    "bin/migrate-v1-to-v2.js",
    "bin/silvermoon.js",
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
    "schema/v2/config.schema.json",
    "schema/v2/idea-event.schema.json",
    "schema/v2/trace-event.schema.json",
    "skills/silvermoon/SKILL.md",
    "skills/silvermoon/references/adoption.md",
    "skills/silvermoon/references/events.md",
    "src/README.md",
    "src/agents/README.md",
    "src/agents/copilot.d.ts",
    "src/agents/copilot.js",
    "src/agents/index.js",
    "src/agents/project-registry.js",
    "src/agents/project-runtime.d.ts",
    "src/agents/project-runtime.js",
    "src/application/README.md",
    "src/application/check.js",
    "src/application/create.js",
    "src/application/event.js",
    "src/application/events/README.md",
    "src/application/events/full-write.js",
    "src/application/events/index.js",
    "src/application/events/recovery.js",
    "src/application/events/replay.js",
    "src/application/events/write.js",
    "src/application/index.js",
    "src/application/list.js",
    "src/application/migrations/README.md",
    "src/application/migrations/index.js",
    "src/application/migrations/v1.js",
    "src/application/next.js",
    "src/application/observation/README.md",
    "src/application/observation/event-candidate.js",
    "src/application/observation/idea-layout.js",
    "src/application/observation/idea-metadata.js",
    "src/application/observation/index.js",
    "src/application/observation/readiness.js",
    "src/application/observation/snapshot.js",
    "src/application/rules/README.md",
    "src/application/rules/index.js",
    "src/application/rules/readiness.js",
    "src/application/scaffold/README.md",
    "src/application/scaffold/index.js",
    "src/application/scaffold/writer.js",
    "src/cli/README.md",
    "src/cli/cli.js",
    "src/cli/index.js",
    "src/command/README.md",
    "src/command/index.js",
    "src/command/rules/README.md",
    "src/command/rules/index.js",
    "src/command/rules/observation.js",
    "src/command/runtime.js",
    "src/command/trace/README.md",
    "src/command/trace/index.js",
    "src/command/trace/trace.js",
    "src/events/README.md",
    "src/events/history.js",
    "src/events/index.js",
    "src/events/projection.js",
    "src/events/rules/README.md",
    "src/events/rules/digest.js",
    "src/events/rules/grammar.js",
    "src/events/rules/index.js",
    "src/events/rules/policy.js",
    "src/events/storage.js",
    "src/events/stream.js",
    "src/idea/README.md",
    "src/idea/index.js",
    "src/idea/query.js",
    "src/idea/rules/README.md",
    "src/idea/rules/index.js",
    "src/idea/rules/query.js",
    "src/idea/rules/status.js",
    "src/idea/rules/templates.js",
    "src/idea/rules/ulid.js",
    "src/idea/scaffold-plan.js",
    "src/index.js",
    "src/presentation/README.md",
    "src/presentation/index.js",
    "src/presentation/render.js",
    "src/presentation/rules/README.md",
    "src/presentation/rules/index.js",
    "src/presentation/rules/markdown.js",
    "src/presentation/tui/README.md",
    "src/presentation/tui/index.js",
    "src/presentation/tui/table.js",
    "src/presentation/tui/tui.js",
    "src/project/README.md",
    "src/project/adoption.js",
    "src/project/config.js",
    "src/project/guidance.js",
    "src/project/index.js",
    "src/project/rules/README.md",
    "src/project/rules/adoption.js",
    "src/project/rules/config.js",
    "src/project/rules/guidance.js",
    "src/project/rules/index.js",
    "src/project/rules/language.js",
    "src/project/rules/layout.js",
    "src/project/rules/repository.js",
    "src/project/rules/yaml.js",
    "src/project/user-config.js",
    "src/repository/README.md",
    "src/repository/derived-cache.js",
    "src/repository/git-snapshot.js",
    "src/repository/git.js",
    "src/repository/index.js",
    "src/repository/state-transaction.js",
    "src/repository/subprocess.js",
    "src/response/README.md",
    "src/response/dialogue.js",
    "src/response/index.js",
    "src/response/instructions.js",
    "src/response/observation.js",
    "src/response/projection.js",
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
      const comparisonCommand = npmCommand(comparisonArguments);
      const comparison = spawnSync(
        comparisonCommand.command,
        comparisonCommand.args,
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
