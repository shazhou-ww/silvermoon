import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { appendFile, mkdir, readFile, stat } from "node:fs/promises";
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

export async function buildNpmTarball({
  packageDirectory,
  outputDirectory,
  spawnImpl = spawnSync,
}) {
  const packageRoot = resolve(packageDirectory);
  const outputRoot = resolve(outputDirectory);
  const packageStatus = await stat(packageRoot);
  if (!packageStatus.isDirectory()) {
    throw new Error(`Package directory is not a directory: ${packageRoot}`);
  }
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
  ].join("\n");
}

function parseArguments(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const option = argv[index];
    const value = argv[index + 1];
    if (!value || !["--package-directory", "--output-directory"].includes(option)) {
      throw new Error(
        "Usage: node scripts/build-npm-tarball.mjs --package-directory <path> --output-directory <path>",
      );
    }
    const key =
      option === "--package-directory" ? "packageDirectory" : "outputDirectory";
    values[key] = value;
  }
  if (!values.packageDirectory || !values.outputDirectory) {
    throw new Error(
      "Usage: node scripts/build-npm-tarball.mjs --package-directory <path> --output-directory <path>",
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
