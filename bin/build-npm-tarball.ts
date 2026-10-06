import { createHash } from "node:crypto";
import { spawnSync, type SpawnSyncOptionsWithStringEncoding, type SpawnSyncReturns } from "node:child_process";
import { appendFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { npmCommand } from "../src/foundation/process/index.ts";

type PackFile = { mode: number; path: string; size: number };
type PackResult = {
  filename: string;
  files: PackFile[];
  integrity: string;
  name: string;
  shasum: string;
  version: string;
};
type SpawnSyncImpl = (
  command: string,
  args: readonly string[],
  options: SpawnSyncOptionsWithStringEncoding,
) => SpawnSyncReturns<string>;
type BuildOptions = {
  packageDirectory: string;
  outputDirectory: string;
  gitHead: string;
  spawnImpl?: SpawnSyncImpl;
};
type TarballMetadata = Awaited<ReturnType<typeof buildNpmTarball>>;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isPackFile(value: unknown): value is PackFile {
  return typeof value === "object" && value !== null
    && typeof Reflect.get(value, "mode") === "number"
    && typeof Reflect.get(value, "path") === "string"
    && typeof Reflect.get(value, "size") === "number";
}

function parsePackResult(stdout: string): PackResult {
  let results: unknown;
  try {
    results = JSON.parse(stdout);
  } catch (error) {
    throw new Error(`Could not parse npm pack output: ${errorMessage(error)}`);
  }
  if (!Array.isArray(results) || results.length !== 1) {
    throw new Error("npm pack must produce exactly one package result.");
  }

  const result: unknown = results[0];
  if (
    !result ||
    typeof result !== "object" ||
    typeof Reflect.get(result, "filename") !== "string" ||
    basename(Reflect.get(result, "filename")) !== Reflect.get(result, "filename") ||
    !Array.isArray(Reflect.get(result, "files")) ||
    !Reflect.get(result, "files").every(isPackFile) ||
    typeof Reflect.get(result, "integrity") !== "string" ||
    typeof Reflect.get(result, "name") !== "string" ||
    typeof Reflect.get(result, "shasum") !== "string" ||
    typeof Reflect.get(result, "version") !== "string"
  ) {
    throw new Error("npm pack returned incomplete package metadata.");
  }
  return {
    filename: Reflect.get(result, "filename"),
    files: Reflect.get(result, "files"),
    integrity: Reflect.get(result, "integrity"),
    name: Reflect.get(result, "name"),
    shasum: Reflect.get(result, "shasum"),
    version: Reflect.get(result, "version"),
  };
}

function digest(algorithm: string, bytes: Buffer, encoding: "base64" | "hex"): string {
  return createHash(algorithm).update(bytes).digest(encoding);
}

function validateGitHead(gitHead: unknown): string {
  if (typeof gitHead !== "string" || !/^[0-9a-f]{40,64}$/i.test(gitHead)) {
    throw new Error("Git head must be a full hexadecimal Git object ID.");
  }
  return gitHead;
}

async function stampReleaseMetadata(packageRoot: string, gitHead: string): Promise<string> {
  const manifestPath = resolve(packageRoot, "package.json");
  const readmeFilename = "README.md";
  let manifest: unknown;
  let readme: string;
  try {
    [manifest, readme] = await Promise.all([
      readFile(manifestPath, "utf8").then((source) => JSON.parse(source)),
      readFile(resolve(packageRoot, readmeFilename), "utf8"),
    ]);
  } catch (error) {
    throw new Error(`Could not read package release metadata: ${errorMessage(error)}`);
  }
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new Error("Package manifest must be a JSON object.");
  }
  if (!readme) {
    throw new Error(`${readmeFilename} must not be empty.`);
  }
  const manifestGitHead = Reflect.get(manifest, "gitHead");
  const manifestReadme = Reflect.get(manifest, "readme");
  const manifestReadmeFilename = Reflect.get(manifest, "readmeFilename");
  if (manifestGitHead && manifestGitHead !== gitHead) {
    throw new Error(
      `Package manifest gitHead mismatch: expected ${gitHead}, found ${String(manifestGitHead)}.`,
    );
  }
  if (manifestReadme !== undefined && manifestReadme !== readme) {
    throw new Error("Package manifest readme does not match README.md.");
  }
  if (
    manifestReadmeFilename !== undefined &&
    manifestReadmeFilename !== readmeFilename
  ) {
    throw new Error(
      `Package manifest readmeFilename must be ${readmeFilename}.`,
    );
  }
  if (
    manifestGitHead !== gitHead ||
    manifestReadme !== readme ||
    manifestReadmeFilename !== readmeFilename
  ) {
    await writeFile(
      manifestPath,
      `${JSON.stringify({
        ...manifest,
        gitHead,
        readme,
        readmeFilename,
      }, null, 2)}\n`,
      "utf8",
    );
  }
  return readmeFilename;
}

export async function buildNpmTarball({
  packageDirectory,
  outputDirectory,
  gitHead,
  spawnImpl = spawnSync,
}: BuildOptions) {
  const packageRoot = resolve(packageDirectory);
  const outputRoot = resolve(outputDirectory);
  const releaseGitHead = validateGitHead(gitHead);
  const packageStatus = await stat(packageRoot);
  if (!packageStatus.isDirectory()) {
    throw new Error(`Package directory is not a directory: ${packageRoot}`);
  }
  const readmeFilename = await stampReleaseMetadata(packageRoot, releaseGitHead);
  await mkdir(outputRoot, { recursive: true });

  const invocation = npmCommand(["pack", "--json", "--pack-destination", outputRoot]);
  const packed = spawnImpl(invocation.command, invocation.args, {
    cwd: packageRoot,
    encoding: "utf8",
    windowsHide: true,
  });
  if (packed.status !== 0) {
    throw new Error(
      packed.stderr || packed.error?.message || "npm pack failed without diagnostics.",
    );
  }

  const result = parsePackResult(packed.stdout);
  const tarballPath = resolve(outputRoot, result.filename);
  const tarballBytes = await readFile(tarballPath);
  const shasum = digest("sha1", tarballBytes, "hex");
  const integrity = `sha512-${digest("sha512", tarballBytes, "base64")}`;
  if (result.shasum !== shasum) {
    throw new Error(
      `npm pack shasum mismatch: reported ${result.shasum}, calculated ${shasum}.`,
    );
  }
  if (result.integrity !== integrity) {
    throw new Error(
      `npm pack integrity mismatch: reported ${result.integrity}, calculated ${integrity}.`,
    );
  }

  return {
    name: result.name,
    version: result.version,
    gitHead: releaseGitHead,
    readmeFilename,
    tarballPath,
    size: tarballBytes.length,
    sha256: digest("sha256", tarballBytes, "hex"),
    shasum,
    integrity,
    files: result.files
      .map(({ mode, path, size }) => ({ path, size, mode }))
      .sort((left, right) => left.path.localeCompare(right.path)),
  };
}

export function formatGitHubOutput(metadata: TarballMetadata): string {
  return [
    `tarball_path=${metadata.tarballPath}`,
    `tarball_sha256=${metadata.sha256}`,
    `tarball_shasum=${metadata.shasum}`,
    `tarball_integrity=${metadata.integrity}`,
    `tarball_file_count=${metadata.files.length}`,
    `tarball_git_head=${metadata.gitHead}`,
    `tarball_readme_filename=${metadata.readmeFilename}`,
  ].join("\n");
}

function parseArguments(argv: readonly string[]): Required<Omit<BuildOptions, "spawnImpl">> {
  const values: Partial<Required<Omit<BuildOptions, "spawnImpl">>> = {};
  for (let index = 0; index < argv.length; index += 2) {
    const option = argv[index];
    const value = argv[index + 1];
    if (
      !value ||
      !option ||
      !["--package-directory", "--output-directory", "--git-head"].includes(option)
    ) {
      throw new Error(
        "Usage: node bin/build-npm-tarball.mjs --package-directory <path> --output-directory <path> --git-head <commit>",
      );
    }
    if (option === "--package-directory") values.packageDirectory = value;
    else if (option === "--output-directory") values.outputDirectory = value;
    else values.gitHead = value;
  }
  if (!values.packageDirectory || !values.outputDirectory || !values.gitHead) {
    throw new Error(
      "Usage: node bin/build-npm-tarball.mjs --package-directory <path> --output-directory <path> --git-head <commit>",
    );
  }
  return {
    packageDirectory: values.packageDirectory,
    outputDirectory: values.outputDirectory,
    gitHead: values.gitHead,
  };
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const metadata = await buildNpmTarball(options);
  if (process.env.GITHUB_OUTPUT) {
    await appendFile(process.env.GITHUB_OUTPUT, `${formatGitHubOutput(metadata)}\n`, "utf8");
  }
  process.stdout.write(`${JSON.stringify(metadata, null, 2)}\n`);
}

const invokedUrl = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedUrl === import.meta.url) {
  main().catch((error: unknown) => {
    process.stderr.write(`npm tarball build failed: ${errorMessage(error)}\n`);
    process.exitCode = 1;
  });
}
