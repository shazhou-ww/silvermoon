import { execFile } from "node:child_process";
import { mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { canonicalRoute, LocalProjectRegistry } from "./project-registry.js";

const execute = promisify(execFile);
const PROTOCOL_VERSION = 1;

async function cliPath(projectRoot) {
  const manifest = JSON.parse(await readFile(join(projectRoot, "package.json"), "utf8"));
  const entry = manifest.name === "silvermoon"
    ? join(projectRoot, "bin", "silvermoon.js")
    : join(projectRoot, "node_modules", "silvermoon", "bin", "silvermoon.js");
  try {
    return await realpath(entry);
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error(`Project version Silvermoon runtime is missing at ${entry}; install project dependencies.`);
    }
    throw error;
  }
}

function decodeReport(output, command, exitCode) {
  let report;
  try {
    report = JSON.parse(output);
  } catch {
    throw new Error(`Project runtime returned invalid JSON for ${command}.`);
  }
  if (!report || typeof report !== "object" || report.intention?.command !== command
    || !report.observation || !report.response || !report.actions) {
    throw new Error(`Project runtime does not support report protocol ${PROTOCOL_VERSION} for ${command}.`);
  }
  return { protocolVersion: PROTOCOL_VERSION, exitCode, report };
}

export class ProjectRuntime {
  #registry;

  constructor({ registry = new LocalProjectRegistry() } = {}) {
    this.#registry = registry;
  }

  async #run(route, command, args) {
    const canonical = canonicalRoute(route);
    const [root, worktree] = await Promise.all([
      this.#registry.projectRoot(canonical),
      this.#registry.resolve(canonical),
    ]);
    const entry = await cliPath(root);
    let stdout;
    let exitCode = 0;
    try {
      ({ stdout } = await execute(process.execPath, [entry, command, ...args, "--json"], {
        cwd: worktree,
        maxBuffer: 32 * 1024 * 1024,
        timeout: 300000,
      }));
    } catch (error) {
      // Exit 1 is the CLI's structured unavailable/invalid result, not a transport failure.
      if (error.code !== 1 || !error.stdout) {
        throw new Error(`Project runtime ${command} failed: ${error.message}`);
      }
      stdout = error.stdout;
      exitCode = 1;
    }
    return decodeReport(stdout, command, exitCode);
  }

  /** The project version alone decides what should happen next. */
  next(route) {
    return this.#run(route, "whats-next", [canonicalRoute(route).ideaId]);
  }

  async replay(route) {
    return this.#run(route, "event", ["replay", canonicalRoute(route).ideaId]);
  }

  async appendInteraction(route, { type, message, expectedLength, expectedDigest }) {
    if ((type !== "ping" && type !== "pong") || typeof message !== "string" || !message.trim()) {
      throw new TypeError("Only nonempty ping/pong messages can be appended through this boundary.");
    }
    if (!Number.isSafeInteger(expectedLength) || expectedLength < 0
      || typeof expectedDigest !== "string" || !/^[a-f0-9]{64}$/.test(expectedDigest)) {
      throw new TypeError("The exact local log length and digest are required.");
    }
    const directory = await mkdtemp(join(tmpdir(), "silvermoon-interaction-"));
    const request = join(directory, "request.json");
    try {
      await writeFile(request, `${JSON.stringify({ type, payload: { message } })}\n`, { mode: 0o600 });
      return await this.#run(route, "event", [
        "append", canonicalRoute(route).ideaId,
        "--input", request,
        "--expected-length", String(expectedLength),
        "--expected-digest", expectedDigest,
      ]);
    } finally {
      await rm(directory, { recursive: true });
    }
  }
}
