import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { validateCanaryVersionForBase } from "./prepare-npm-release.ts";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function validateCanaryVersion(baseVersion: unknown, version: unknown): string {
  if (typeof baseVersion !== "string") {
    throw new Error(`Canary base version must be stable canonical SemVer: ${String(baseVersion)}`);
  }
  if (typeof version !== "string") {
    throw new Error(`Canary version must be canonical SemVer: ${String(version)}`);
  }
  return validateCanaryVersionForBase({ baseVersion, version });
}

export async function stageNpmCanary({
  packageDirectory,
  version,
}: {
  packageDirectory: string;
  version: string;
}): Promise<void> {
  const manifestPath = resolve(packageDirectory, "package.json");
  const manifest: unknown = JSON.parse(await readFile(manifestPath, "utf8"));
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new Error("Canary package manifest must be a JSON object.");
  }
  const candidateVersion = validateCanaryVersion(
    Reflect.get(manifest, "version"),
    version,
  );
  await writeFile(
    manifestPath,
    `${JSON.stringify({ ...manifest, version: candidateVersion }, null, 2)}\n`,
    "utf8",
  );
}

function parseArguments(argv: readonly string[]) {
  const values: { packageDirectory?: string; version?: string } = {};
  for (let index = 0; index < argv.length; index += 2) {
    const option = argv[index];
    const value = argv[index + 1];
    if (
      !option ||
      !value ||
      !["--package-directory", "--version"].includes(option)
    ) {
      throw new Error(
        "Usage: node bin/stage-npm-canary.ts --package-directory <path> --version <semver>",
      );
    }
    if (option === "--package-directory") values.packageDirectory = value;
    else values.version = value;
  }
  if (!values.packageDirectory || !values.version) {
    throw new Error(
      "Usage: node bin/stage-npm-canary.ts --package-directory <path> --version <semver>",
    );
  }
  return {
    packageDirectory: values.packageDirectory,
    version: values.version,
  };
}

async function main() {
  await stageNpmCanary(parseArguments(process.argv.slice(2)));
}

const invokedUrl = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedUrl === import.meta.url) {
  main().catch((error: unknown) => {
    process.stderr.write(`Canary staging failed: ${errorMessage(error)}\n`);
    process.exitCode = 1;
  });
}
