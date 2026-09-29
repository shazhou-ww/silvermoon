import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { appendFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function packCommand(outputDirectory) {
  if (process.platform === "win32") {
    const configuredNpmCli = process.env.npm_execpath;
    const npmCli =
      configuredNpmCli && /^npm-cli\.js$/i.test(basename(configuredNpmCli))
        ? configuredNpmCli
        : resolve(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");
    return {
      command: process.execPath,
      args: [npmCli, "pack", "--json", "--pack-destination", outputDirectory],
    };
  }
  return {
    command: "npm",
    args: ["pack", "--json", "--pack-destination", outputDirectory],
  };
}

function parsePackResult(stdout) {
  let results;
  try {
    results = JSON.parse(stdout);
  } catch (error) {
    throw new Error(`Could not parse npm pack output: ${error.message}`);
  }
  if (!Array.isArray(results) || results.length !== 1) {
    throw new Error("npm pack must produce exactly one package result.");
  }

  const [result] = results;
  if (
    !result ||
    typeof result !== "object" ||
    typeof result.filename !== "string" ||
    basename(result.filename) !== result.filename ||
    !Array.isArray(result.files)
  ) {
    throw new Error("npm pack returned incomplete package metadata.");
  }
  return result;
}

function digest(algorithm, bytes, encoding) {
  return createHash(algorithm).update(bytes).digest(encoding);
}

function validateGitHead(gitHead) {
  if (!/^[0-9a-f]{40,64}$/i.test(gitHead ?? "")) {
    throw new Error("Git head must be a full hexadecimal Git object ID.");
  }
  return gitHead;
}

async function stampReleaseMetadata(packageRoot, gitHead) {
  const manifestPath = resolve(packageRoot, "package.json");
  const readmeFilename = "README.md";
  let manifest;
  let readme;
  try {
    [manifest, readme] = await Promise.all([
      readFile(manifestPath, "utf8").then((source) => JSON.parse(source)),
      readFile(resolve(packageRoot, readmeFilename), "utf8"),
    ]);
  } catch (error) {
    throw new Error(`Could not read package release metadata: ${error.message}`);
  }
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new Error("Package manifest must be a JSON object.");
  }
  if (!readme) {
    throw new Error(`${readmeFilename} must not be empty.`);
  }
  if (manifest.gitHead && manifest.gitHead !== gitHead) {
    throw new Error(
      `Package manifest gitHead mismatch: expected ${gitHead}, found ${manifest.gitHead}.`,
    );
  }
  if (manifest.readme !== undefined && manifest.readme !== readme) {
    throw new Error("Package manifest readme does not match README.md.");
  }
  if (
    manifest.readmeFilename !== undefined &&
    manifest.readmeFilename !== readmeFilename
  ) {
    throw new Error(
      `Package manifest readmeFilename must be ${readmeFilename}.`,
    );
  }
  if (
    manifest.gitHead !== gitHead ||
    manifest.readme !== readme ||
    manifest.readmeFilename !== readmeFilename
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
}) {
  const packageRoot = resolve(packageDirectory);
  const outputRoot = resolve(outputDirectory);
  const releaseGitHead = validateGitHead(gitHead);
  const packageStatus = await stat(packageRoot);
  if (!packageStatus.isDirectory()) {
    throw new Error(`Package directory is not a directory: ${packageRoot}`);
  }
  const readmeFilename = await stampReleaseMetadata(packageRoot, releaseGitHead);
  await mkdir(outputRoot, { recursive: true });

  const invocation = packCommand(outputRoot);
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

export function formatGitHubOutput(metadata) {
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

function parseArguments(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const option = argv[index];
    const value = argv[index + 1];
    if (
      !value ||
      !["--package-directory", "--output-directory", "--git-head"].includes(option)
    ) {
      throw new Error(
        "Usage: node scripts/build-npm-tarball.mjs --package-directory <path> --output-directory <path> --git-head <commit>",
      );
    }
    const key = {
      "--package-directory": "packageDirectory",
      "--output-directory": "outputDirectory",
      "--git-head": "gitHead",
    }[option];
    values[key] = value;
  }
  if (!values.packageDirectory || !values.outputDirectory || !values.gitHead) {
    throw new Error(
      "Usage: node scripts/build-npm-tarball.mjs --package-directory <path> --output-directory <path> --git-head <commit>",
    );
  }
  return values;
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
  main().catch((error) => {
    process.stderr.write(`npm tarball build failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}
