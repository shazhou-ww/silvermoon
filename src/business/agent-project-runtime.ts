import { execFile } from "node:child_process";
import { mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { canonicalRoute, LocalProjectRegistry } from "./agent-project-registry.ts";
import { validateIdeaEvent } from "../foundation/event-codec/index.ts";
import type { IdeaRoute } from "./agent-copilot.ts";

const execute = promisify(execFile);
const PROTOCOL_VERSION = 1;

export interface ProjectReport {
  readonly intention: {
    readonly command: string;
    readonly args?: Record<string, unknown>;
  };
  readonly observation: Record<string, unknown>;
  readonly actions: readonly unknown[];
  readonly response: Record<string, unknown>;
}

export interface RuntimeResult {
  readonly protocolVersion: 1;
  readonly exitCode: 0 | 1;
  readonly report: ProjectReport;
}

interface EventReceipt extends Record<string, unknown> {
  id: string;
  outcome: string;
  length: number;
  digest: string;
  events?: unknown;
  sequence?: unknown;
  after?: unknown;
}

interface RuntimeObservation extends Record<string, unknown> {
  state: string;
  receipt?: EventReceipt;
}

interface DecodedReport extends ProjectReport {
  readonly observation: RuntimeObservation;
  readonly response: Record<string, unknown> & { nextSteps: unknown[] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function errorCode(error: unknown): string | number | undefined {
  return error instanceof Error && "code" in error
    && (typeof error.code === "string" || typeof error.code === "number")
    ? error.code
    : undefined;
}

function eventSequence(event: unknown): number {
  if (!isRecord(event) || !Number.isSafeInteger(event.sequence)
    || typeof event.sequence !== "number") {
    throw new Error("Project runtime returned an event without a valid sequence.");
  }
  return event.sequence;
}

function decodeEventReceipt(value: unknown): EventReceipt | undefined {
  if (!isRecord(value)
    || typeof value.id !== "string"
    || typeof value.outcome !== "string"
    || typeof value.length !== "number"
    || typeof value.digest !== "string") {
    return undefined;
  }
  return {
    ...value,
    id: value.id,
    outcome: value.outcome,
    length: value.length,
    digest: value.digest,
  };
}

async function cliPath(projectRoot: string): Promise<string> {
  const parsed: unknown = JSON.parse(await readFile(join(projectRoot, "package.json"), "utf8"));
  if (!isRecord(parsed) || typeof parsed.name !== "string") {
    throw new Error("Project package.json must contain a string name.");
  }
  const entry = parsed.name === "silvermoon"
    ? join(projectRoot, "bin", "silvermoon.ts")
    : join(projectRoot, "node_modules", "silvermoon", "dist", "bin", "silvermoon.js");
  try {
    return await realpath(entry);
  } catch (error) {
    if (errorCode(error) === "ENOENT") {
      throw new Error(`Project version Silvermoon runtime is missing at ${entry}; install project dependencies.`);
    }
    throw error;
  }
}

function decodeReport(
  output: string,
  command: string,
  operation: string | undefined,
  ideaId: string,
  exitCode: 0 | 1,
): RuntimeResult & { report: DecodedReport } {
  let report: unknown;
  try {
    report = JSON.parse(output);
  } catch {
    throw new Error(`Project runtime returned invalid JSON for ${command}.`);
  }
  const intention = isRecord(report) && isRecord(report.intention) ? report.intention : undefined;
  const args = intention && isRecord(intention.args) ? intention.args : undefined;
  const observation = isRecord(report) && isRecord(report.observation) ? report.observation : undefined;
  const response = isRecord(report) && isRecord(report.response) ? report.response : undefined;
  const receipt = decodeEventReceipt(observation?.receipt);
  if (!isRecord(report) || !intention || intention.command !== command
    || !args || args.idea !== ideaId
    || (operation && args.operation !== operation)
    || !observation || typeof observation.state !== "string"
    || !response || !Array.isArray(response.nextSteps)
    || !Array.isArray(report.actions)
    || (command === "event" && observation.state === "event-result"
      && (!receipt || receipt.id !== ideaId
        || typeof receipt.outcome !== "string"
        || !Number.isSafeInteger(receipt.length)
        || typeof receipt.digest !== "string"
        || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(receipt.digest)))) {
    throw new Error(`Project runtime does not support report protocol ${PROTOCOL_VERSION} for ${command}.`);
  }
  return {
    protocolVersion: PROTOCOL_VERSION,
    exitCode,
    report: {
      intention: {
        command,
        args,
      },
      observation: {
        ...observation,
        ...(receipt ? { receipt } : {}),
        state: observation.state,
      },
      actions: report.actions,
      response: { ...response, nextSteps: response.nextSteps },
    },
  };
}

export class ProjectRuntime {
  #registry: LocalProjectRegistry;

  constructor({ registry = new LocalProjectRegistry() }: { registry?: LocalProjectRegistry } = {}) {
    this.#registry = registry;
  }

  async #run(route: IdeaRoute, command: string, args: string[]): Promise<RuntimeResult & { report: DecodedReport }> {
    const canonical = canonicalRoute(route);
    const [root, worktree] = await Promise.all([
      this.#registry.projectRoot(canonical),
      this.#registry.resolve(canonical),
    ]);
    const entry = await cliPath(root);
    let stdout: string;
    let exitCode: 0 | 1 = 0;
    try {
      ({ stdout } = await execute(process.execPath, [entry, command, ...args, "--json"], {
        cwd: worktree,
        maxBuffer: 32 * 1024 * 1024,
        timeout: 300000,
      }));
    } catch (error) {
      // Exit 1 is the CLI's structured unavailable/invalid result, not a transport failure.
      const failureCode = errorCode(error);
      const failureStdout = error instanceof Error && "stdout" in error
        && typeof error.stdout === "string" ? error.stdout : undefined;
      if (failureCode !== 1 || !failureStdout) {
        throw new Error(`Project runtime ${command} failed: ${error instanceof Error ? error.message : String(error)}`);
      }
      stdout = failureStdout;
      exitCode = 1;
    }
    return decodeReport(stdout, command, command === "event" ? args[0] : undefined, canonical.ideaId, exitCode);
  }

  /** The project version alone decides what should happen next. */
  next(route: IdeaRoute): Promise<RuntimeResult> {
    return this.#run(route, "whats-next", [canonicalRoute(route).ideaId]);
  }

  async replay(route: IdeaRoute): Promise<RuntimeResult> {
    return this.#run(route, "event", ["replay", canonicalRoute(route).ideaId]);
  }

  async readSince(
    route: IdeaRoute,
    { length, digest }: { length: number; digest: string },
  ): Promise<RuntimeResult> {
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
      if (!receipt) throw new Error("Project runtime omitted the incremental replay receipt.");
      const after = isRecord(receipt.after) ? receipt.after : undefined;
      if (receipt.outcome !== "delta-observed" || !Array.isArray(receipt.events)
        || !Number.isSafeInteger(receipt.sequence) || typeof receipt.sequence !== "number"
        || receipt.sequence < 0
        || receipt.length < length || after?.length !== length || after.digest !== digest) {
        throw new Error("Project runtime returned an invalid incremental replay receipt.");
      }
      for (const event of receipt.events) {
        Reflect.apply(validateIdeaEvent, undefined, [
          event,
          { objectIdLength: receipt.digest.length },
        ]);
      }
      const sequences = receipt.events.map(eventSequence);
      if (sequences.some((sequence, index) =>
        index > 0 && sequence !== sequences[index - 1]! + 1)
        || (sequences.length > 0 && sequences.at(-1) !== receipt.sequence)) {
        throw new Error("Project runtime returned inconsistent incremental event sequences.");
      }
    }
    return result;
  }

  async appendInteraction(
    route: IdeaRoute,
    { type, message, expectedLength, expectedDigest }: {
      type: "ping" | "pong";
      message: string;
      expectedLength: number;
      expectedDigest: string;
    },
  ): Promise<RuntimeResult> {
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
