import { execFile } from "node:child_process";
import { mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { canonicalRoute, LocalProjectRegistry } from "./project-registry.js";
import { validateIdeaEvent } from "../events/rules/index.js";

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

function decodeReport(output, command, operation, ideaId, exitCode) {
  let report;
  try {
    report = JSON.parse(output);
  } catch {
    throw new Error(`Project runtime returned invalid JSON for ${command}.`);
  }
  if (!report || typeof report !== "object" || report.intention?.command !== command
    || report.intention.args?.idea !== ideaId
    || (operation && report.intention.args?.operation !== operation)
    || !report.observation || typeof report.observation.state !== "string"
    || !report.response || !Array.isArray(report.response.nextSteps)
    || !Array.isArray(report.actions)
    || (command === "event" && report.observation.state === "event-result"
      && (report.observation.receipt?.id !== ideaId
        || typeof report.observation.receipt.outcome !== "string"
        || !Number.isSafeInteger(report.observation.receipt.length)
        || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(report.observation.receipt.digest ?? "")))) {
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
    return decodeReport(stdout, command, command === "event" ? args[0] : undefined, canonical.ideaId, exitCode);
  }

  /** The project version alone decides what should happen next. */
  next(route) {
    return this.#run(route, "whats-next", [canonicalRoute(route).ideaId]);
  }

  async replay(route) {
    return this.#run(route, "event", ["replay", canonicalRoute(route).ideaId]);
  }

  async readSince(route, { length, digest }) {
    if (!Number.isSafeInteger(length) || length < 0
      || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(digest ?? "")) {
      throw new TypeError("Incremental replay requires an exact length and folder digest cursor.");
    }
    const result = await this.#run(route, "event", [
      "replay", canonicalRoute(route).ideaId,
      "--after-length", String(length), "--after-digest", digest,
    ]);
    if (result.exitCode === 0) {
      const receipt = result.report.observation.receipt;
      if (receipt.outcome !== "delta-observed" || !Array.isArray(receipt.events)
        || !Number.isSafeInteger(receipt.sequence) || receipt.sequence < 0
        || receipt.length < length || receipt.after?.length !== length || receipt.after?.digest !== digest) {
        throw new Error("Project runtime returned an invalid incremental replay receipt.");
      }
      for (const event of receipt.events) validateIdeaEvent(event, { objectIdLength: receipt.digest.length });
      if (receipt.events.some((event, index) =>
        index > 0 && event.sequence !== receipt.events[index - 1].sequence + 1)
        || (receipt.events.length && receipt.events.at(-1).sequence !== receipt.sequence)) {
        throw new Error("Project runtime returned inconsistent incremental event sequences.");
      }
    }
    return result;
  }

  async appendInteraction(route, { type, message, expectedLength, expectedDigest }) {
    if ((type !== "ping" && type !== "pong") || typeof message !== "string" || !message.trim()) {
      throw new TypeError("Only nonempty ping/pong messages can be appended through this boundary.");
    }
    if (!Number.isSafeInteger(expectedLength) || expectedLength < 0
      || typeof expectedDigest !== "string" || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(expectedDigest)) {
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
