import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { inspectNpmTarball } from "../src/foundation/package-resource/index.ts";
import { npmCommand } from "../src/foundation/process/index.ts";

const packageRoot = fileURLToPath(new URL("..", import.meta.url));
type PackFile = { path: string; size: number };
type PackResult = {
  files: PackFile[];
  integrity?: string;
  name?: string;
  version?: string;
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function parsePackResults(source: string): PackResult[] {
  const parsed: unknown = JSON.parse(source);
  if (!Array.isArray(parsed)) throw new Error("npm pack returned invalid metadata.");
  return parsed.map((value: unknown) => {
    if (typeof value !== "object" || value === null) {
      throw new Error("npm pack returned invalid metadata.");
    }
    const files = Reflect.get(value, "files");
    if (!Array.isArray(files) || !files.every((file: unknown) =>
      typeof file === "object" && file !== null
      && typeof Reflect.get(file, "path") === "string"
      && typeof Reflect.get(file, "size") === "number")) {
      throw new Error("npm pack returned invalid file metadata.");
    }
    const integrity = Reflect.get(value, "integrity");
    const name = Reflect.get(value, "name");
    const version = Reflect.get(value, "version");
    if (integrity !== undefined && typeof integrity !== "string") {
      throw new Error("npm pack returned invalid integrity metadata.");
    }
    return {
      files,
      ...(integrity === undefined ? {} : { integrity }),
      ...(typeof name === "string" ? { name } : {}),
      ...(typeof version === "string" ? { version } : {}),
    };
  });
}
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
  const result = parsePackResults(packed.stdout)[0];
  if (!result) throw new Error("npm pack returned no package metadata.");
  const files = result.files.map(({ path }: PackFile) => path).sort();
  const maintained = [
    "LICENSE",
    "README.md",
    "README.zh-CN.md",
    "bin/build-npm-tarball.mjs",
    "bin/check-pack.js",
    "bin/ci-package-risk.mjs",
    "bin/generate-npm-readme.mjs",
    "bin/migrate-v1-to-v2.js",
    "bin/prepare-npm-release.mjs",
    "bin/pure-check.mjs",
    "bin/run-checks.mjs",
    "bin/silvermoon.js",
    "bin/sync-skills.mjs",
    "bin/verify-npm-release.mjs",
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
    "src/business/README.md",
    "src/business/agent-copilot.d.ts",
    "src/business/agent-copilot.js",
    "src/business/agent-project-registry.js",
    "src/business/agent-project-runtime.d.ts",
    "src/business/agent-project-runtime.js",
    "src/business/append-event-history.js",
    "src/business/append-event.js",
    "src/business/check-repository.js",
    "src/business/create-idea.js",
    "src/business/event-command.js",
    "src/business/index.js",
    "src/business/list-ideas.js",
    "src/business/migrate-v1-to-v2.js",
    "src/business/replay-events.js",
    "src/business/shared/README.md",
    "src/business/shared/assess-idea-creation-readiness.js",
    "src/business/shared/assess-repository-readiness-with.js",
    "src/business/shared/assess-repository-readiness.js",
    "src/business/shared/business-types.js",
    "src/business/shared/evaluate-local-readiness.js",
    "src/business/shared/evaluate-primary-relation.js",
    "src/business/shared/idea-layout.js",
    "src/business/shared/index.js",
    "src/business/shared/inspect-candidate.js",
    "src/business/shared/metadata-failure-observation.js",
    "src/business/shared/observe-device.js",
    "src/business/shared/observe-idea.js",
    "src/business/shared/observe-project.js",
    "src/business/shared/observe-snapshot.js",
    "src/business/shared/read-idea-inventory-item.js",
    "src/business/shared/resolve-idea.js",
    "src/business/shared/with-observation-language.js",
    "src/business/whats-next.js",
    "src/foundation/command-message/README.md",
    "src/foundation/command-message/index.js",
    "src/foundation/command-message/observation.js",
    "src/foundation/command-message/runtime.js",
    "src/foundation/coordinates/README.md",
    "src/foundation/coordinates/index.js",
    "src/foundation/coordinates/layout.js",
    "src/foundation/coordinates/repository.js",
    "src/foundation/device-config/README.md",
    "src/foundation/device-config/index.js",
    "src/foundation/device-config/user-config.js",
    "src/foundation/event-codec/README.md",
    "src/foundation/event-codec/grammar.js",
    "src/foundation/event-codec/index.js",
    "src/foundation/event-cursor/README.md",
    "src/foundation/event-cursor/cursor.js",
    "src/foundation/event-cursor/index.js",
    "src/foundation/event-history/README.md",
    "src/foundation/event-history/digest.js",
    "src/foundation/event-history/history.js",
    "src/foundation/event-history/index.js",
    "src/foundation/event-reducer/README.md",
    "src/foundation/event-reducer/index.js",
    "src/foundation/event-reducer/policy.js",
    "src/foundation/event-store/README.md",
    "src/foundation/event-store/digest.js",
    "src/foundation/event-store/index.js",
    "src/foundation/event-store/storage.js",
    "src/foundation/event-store/stream.js",
    "src/foundation/git/README.md",
    "src/foundation/git/derived-cache.js",
    "src/foundation/git/git.js",
    "src/foundation/git/index.js",
    "src/foundation/guidance/README.md",
    "src/foundation/guidance/guidance.js",
    "src/foundation/guidance/index.js",
    "src/foundation/guidance/rules.js",
    "src/foundation/idea-model/README.md",
    "src/foundation/idea-model/index.js",
    "src/foundation/idea-model/status.js",
    "src/foundation/idea-model/ulid.js",
    "src/foundation/idea-query/README.md",
    "src/foundation/idea-query/index.js",
    "src/foundation/idea-query/query.js",
    "src/foundation/idea-query/rules.js",
    "src/foundation/idea-template/README.md",
    "src/foundation/idea-template/index.js",
    "src/foundation/idea-template/templates.js",
    "src/foundation/installation/README.md",
    "src/foundation/installation/index.js",
    "src/foundation/installation/installation.js",
    "src/foundation/language/README.md",
    "src/foundation/language/index.js",
    "src/foundation/language/language.js",
    "src/foundation/owned-write/README.md",
    "src/foundation/owned-write/index.js",
    "src/foundation/owned-write/writer.js",
    "src/foundation/package-resource/README.md",
    "src/foundation/package-resource/index.js",
    "src/foundation/package-resource/npm-tarball.mjs",
    "src/foundation/process/README.md",
    "src/foundation/process/index.js",
    "src/foundation/process/npm-command.mjs",
    "src/foundation/process/subprocess.js",
    "src/foundation/project-config/README.md",
    "src/foundation/project-config/config.js",
    "src/foundation/project-config/index.js",
    "src/foundation/project-config/rules.js",
    "src/foundation/projection-cache/README.md",
    "src/foundation/projection-cache/index.js",
    "src/foundation/projection-cache/projection.js",
    "src/foundation/renderer/README.md",
    "src/foundation/renderer/index.js",
    "src/foundation/renderer/markdown.js",
    "src/foundation/renderer/render.js",
    "src/foundation/report/README.md",
    "src/foundation/report/dialogue.js",
    "src/foundation/report/index.js",
    "src/foundation/report/instructions.js",
    "src/foundation/report/observation.js",
    "src/foundation/report/projection.js",
    "src/foundation/report/types.js",
    "src/foundation/scaffold-plan/README.md",
    "src/foundation/scaffold-plan/index.js",
    "src/foundation/scaffold-plan/scaffold-plan.js",
    "src/foundation/schema/README.md",
    "src/foundation/schema/index.js",
    "src/foundation/schema/schema.js",
    "src/foundation/schema/yaml.js",
    "src/foundation/skill-registration/README.md",
    "src/foundation/skill-registration/adoption.js",
    "src/foundation/skill-registration/index.js",
    "src/foundation/skill-registration/rules.js",
    "src/foundation/snapshot/README.md",
    "src/foundation/snapshot/git-snapshot.js",
    "src/foundation/snapshot/index.js",
    "src/foundation/state-transaction/README.md",
    "src/foundation/state-transaction/index.js",
    "src/foundation/state-transaction/state-transaction.js",
    "src/foundation/terminal/README.md",
    "src/foundation/terminal/index.js",
    "src/foundation/terminal/terminal.js",
    "src/foundation/trace/README.md",
    "src/foundation/trace/index.js",
    "src/foundation/trace/trace.js",
    "src/foundation/tui/README.md",
    "src/foundation/tui/index.js",
    "src/foundation/tui/table.js",
    "src/foundation/tui/tui.js",
    "src/index.js",
  ];
  const compiledArtifacts = maintained.flatMap((path: string) => {
    if (/^src\/.+\/README\.md$/.test(path) || path === "src/README.md") return [];
    if (!/^(?:bin|src)\/.+\.(?:js|mjs|d\.ts)$/.test(path)) return [path];
    const modulePath = path
      .replace(/^bin\//, "dist/bin/")
      .replace(/^src\//, "dist/src/")
      .replace(/\.mjs$/, ".js")
      .replace(/\.d\.ts$/, ".js");
    return [
      modulePath,
      `${modulePath}.map`,
      modulePath.replace(/\.js$/, ".d.ts"),
      modulePath.replace(/\.js$/, ".d.ts.map"),
    ];
  });
  const expected = [...new Set(compiledArtifacts)].sort();
  const missing = expected.filter((path: string) => !files.includes(path));
  const unexpected = files.filter((path: string) => !expected.includes(path));
  const sourceOrShim = files.filter((path: string) =>
    path.startsWith("src/")
    || path.startsWith("bin/"));

  const emptyReadme = result.files.find(
    ({ path, size }: PackFile) => path === "README.md" && !(size > 0),
  );
  const integrityMismatch =
    expectedIntegrity && result.integrity !== expectedIntegrity;
  let actualGitHead;
  let readmeMetadataMismatch = false;
  if (expectedGitHead && tarball) {
    try {
      const inspected = await inspectNpmTarball(tarball);
      actualGitHead = inspected.manifest.gitHead;
      readmeMetadataMismatch =
        inspected.manifest.readmeFilename !== "README.md" ||
        inspected.manifest.readme !==
          inspected.entries.get("README.md")?.toString("utf8");
    } catch (error: unknown) {
      process.stderr.write(`Could not inspect configured npm tarball: ${errorMessage(error)}\n`);
      process.exit(1);
    }
  }
  const gitHeadMismatch =
    expectedGitHead && actualGitHead !== expectedGitHead;
  let directoryPackMismatch = false;
  if (expectedGitHead && tarball) {
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
      const comparisonResults: unknown = JSON.parse(comparison.stdout);
      const comparisonFilename = Array.isArray(comparisonResults)
        && typeof comparisonResults[0] === "object" && comparisonResults[0] !== null
        ? Reflect.get(comparisonResults[0], "filename")
        : undefined;
      if (
        !Array.isArray(comparisonResults) ||
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
    sourceOrShim.length > 0 ||
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
    if (sourceOrShim.length > 0) {
      process.stderr.write(
        `Packed source or generated bin shim: ${sourceOrShim.join(", ")}\n`,
      );
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
