import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access, lstat, readFile, readdir, realpath } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import type { CheckRequest, ObjectiveCheckRunner } from "./types.ts";
import { ObjectiveConfigurationError, ObjectiveOperationError } from "./validation.ts";

const OUTPUT_LIMIT = 1024 * 1024;
const CHECK_TIMEOUT_MS = 30_000;

function inside(root: string, path: string) {
  const child = relative(root, path);
  return child === "" || (!child.startsWith("..") && !child.includes(":"));
}

async function resolveEntry(manifestUri: string, checkId: string) {
  const url = new URL(manifestUri);
  if (url.protocol !== "file:") {
    throw new ObjectiveConfigurationError(`Executable checks require a local file Manifest: ${manifestUri}.`);
  }
  const guideRoot = dirname(fileURLToPath(url));
  const directory = join(guideRoot, "checks", checkId);
  const directoryMetadata = await lstat(directory);
  if (!directoryMetadata.isDirectory() || directoryMetadata.isSymbolicLink()) {
    throw new ObjectiveConfigurationError(`Check must be a regular directory: ${checkId}.`);
  }
  const entries = (await readdir(directory)).filter((name) => name === "run" || name.startsWith("run."));
  if (entries.length !== 1) {
    throw new ObjectiveConfigurationError(`Check requires exactly one run or run.* entry: ${checkId}.`);
  }
  const entry = join(directory, entries[0]!);
  const metadata = await lstat(entry);
  if (!metadata.isFile() || metadata.isSymbolicLink()) {
    throw new ObjectiveConfigurationError(`Check entry must be a regular file: ${checkId}.`);
  }
  const [realRoot, realEntry] = await Promise.all([realpath(guideRoot), realpath(entry)]);
  if (!inside(realRoot, realEntry)) throw new ObjectiveConfigurationError(`Check entry escapes Guide root: ${checkId}.`);
  return { directory, entry: realEntry };
}

async function commandFor(entry: string) {
  if (process.platform !== "win32") {
    await access(entry, constants.X_OK);
    return { command: entry, args: [] as string[] };
  }
  if (entry.toLowerCase().endsWith(".exe")) return { command: entry, args: [] as string[] };
  const firstLine = (await readFile(entry, "utf8")).split(/\r?\n/, 1)[0] ?? "";
  const shebang = /^#!\/usr\/bin\/env ([A-Za-z0-9._+-]+)$/.exec(firstLine);
  if (shebang === null) {
    throw new ObjectiveConfigurationError("Windows script checks require #!/usr/bin/env <interpreter>.");
  }
  return { command: shebang[1]!, args: [entry] };
}

async function execute(command: string, args: readonly string[], request: CheckRequest, cwd: string) {
  const inherited = process.platform === "win32"
    ? ["Path", "PATH", "SystemRoot", "WINDIR", "TEMP", "TMP"]
    : ["PATH", "HOME", "TMPDIR", "LANG", "LC_ALL"];
  const env = Object.fromEntries(inherited.flatMap((key) =>
    process.env[key] === undefined ? [] : [[key, process.env[key]!]]));
  return await new Promise<unknown>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      shell: false,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timer = setTimeout(() => {
      child.kill();
      finish(new ObjectiveOperationError(`Check timed out after ${CHECK_TIMEOUT_MS}ms.`));
    }, CHECK_TIMEOUT_MS);
    function finish(error?: Error, value?: unknown) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error === undefined) resolve(value);
      else reject(error);
    }
    child.once("error", (error) => finish(new ObjectiveOperationError(`Check failed to start: ${error.message}.`, { cause: error })));
    child.stdin.once("error", (error) =>
      finish(new ObjectiveOperationError(`Check stdin failed: ${error.message}.`, { cause: error })));
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
      if (Buffer.byteLength(stdout) > OUTPUT_LIMIT) {
        child.kill();
        finish(new ObjectiveOperationError("Check stdout exceeded the output limit."));
      }
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
      if (Buffer.byteLength(stderr) > OUTPUT_LIMIT) {
        child.kill();
        finish(new ObjectiveOperationError("Check stderr exceeded the output limit."));
      }
    });
    child.once("close", (code, signal) => {
      if (settled) return;
      if (code !== 0) {
        finish(new ObjectiveOperationError(
          `Check exited unsuccessfully (${code ?? signal ?? "unknown"}): ${stderr.trim() || "no stderr"}.`,
        ));
        return;
      }
      try {
        finish(undefined, JSON.parse(stdout.trim()));
      } catch (caught) {
        finish(new ObjectiveOperationError("Check stdout must contain exactly one JSON result.", { cause: caught }));
      }
    });
    child.stdin.end(JSON.stringify(request));
  });
}

export const fileObjectiveCheckRunner: ObjectiveCheckRunner = {
  async validate(manifestUri, checkId) {
    const { entry } = await resolveEntry(manifestUri, checkId);
    await commandFor(entry);
  },
  async run(manifestUri, checkId, request) {
    const { directory, entry } = await resolveEntry(manifestUri, checkId);
    const { command, args } = await commandFor(entry);
    return await execute(command, args, request, directory);
  },
};
