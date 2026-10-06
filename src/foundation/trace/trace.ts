import { AsyncLocalStorage } from "node:async_hooks";
import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { access, lstat, open } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export const TRACE_SCHEMA_VERSION = 2;
type TraceAttributes = Record<string, unknown>;

interface TraceSpan {
  attributes: TraceAttributes;
  id: string;
  name: string;
  parentSpanId: string | null;
  started: bigint;
}

interface TraceSummary {
  attributes?: TraceAttributes;
  status?: string;
}

interface TraceContext {
  parentSpanId: string | null;
  trace: Trace;
}

const traceContext = new AsyncLocalStorage<TraceContext>();

function durationMilliseconds(started: bigint) {
  return Math.round(Number(process.hrtime.bigint() - started) / 1_000) / 1_000;
}

function errorName(caught: unknown) {
  return caught instanceof Error ? caught.name : typeof caught;
}

class Trace {
  events: TraceAttributes[];
  nextSequence: number;
  nextSpanId: number;
  traceId: string;

  constructor() {
    this.events = [];
    this.nextSequence = 1;
    this.nextSpanId = 1;
    this.traceId = randomUUID();
  }

  emit(event: TraceAttributes) {
    this.events.push({
      schemaVersion: TRACE_SCHEMA_VERSION,
      traceId: this.traceId,
      sequence: this.nextSequence,
      timestamp: new Date().toISOString(),
      ...event,
    });
    this.nextSequence += 1;
  }

  start(name: string, parentSpanId: string | null, attributes: TraceAttributes) {
    const span = {
      attributes,
      id: String(this.nextSpanId),
      name,
      parentSpanId,
      started: process.hrtime.bigint(),
    };
    this.nextSpanId += 1;
    this.emit({
      channel: "telemetry",
      event: "span-start",
      spanId: span.id,
      parentSpanId,
      name,
      attributes,
    });
    return span;
  }

  end(span: TraceSpan, status: string, attributes: TraceAttributes = {}) {
    this.emit({
      channel: "telemetry",
      event: "span-end",
      spanId: span.id,
      parentSpanId: span.parentSpanId,
      name: span.name,
      status,
      durationMs: durationMilliseconds(span.started),
      attributes: { ...span.attributes, ...attributes },
    });
  }

  serialize() {
    return `${this.events.map((event) => JSON.stringify(event)).join("\n")}\n`;
  }
}

async function requireAvailableTracePath(path: string) {
  const parent = dirname(path);
  const parentMetadata = await lstat(parent);
  if (!parentMetadata.isDirectory()) {
    throw new Error(`Trace parent is not a directory: ${parent}`);
  }
  await access(parent, constants.W_OK);
  try {
    await lstat(path);
  } catch (caught) {
    if (caught instanceof Error && "code" in caught && caught.code === "ENOENT") return;
    throw caught;
  }
  throw new Error(`Trace file already exists: ${path}`);
}

async function traceAsyncLegacy(
  name: string,
  attributes: { command?: string; phase?: unknown; scope?: string; actionId?: unknown; actionType?: unknown; candidateCount?: number; ideaCount?: unknown; renderer?: string; },
  callback: { (): Promise<unknown>; (): Promise<unknown>; (): Promise<unknown>; (): Promise<unknown>; (): Promise<unknown>; (): Promise<unknown>; (): Promise<never>; (): Promise<void>; (): unknown; (): unknown; (): Promise<unknown>; (): Promise<string>; (): Promise<string>; (): Promise<{ config: unknown; configPath: unknown; diagnostics: { code: string|undefined; level: string; path: string; message: string; remediation: string; }[]; }>; (): Promise<{ npmProject: boolean; findings: never[]; manifest?: never; packageManager?: never; sourceCheckout?: never; }|{ npmProject: boolean; findings: { priority: number; problem: { type: string; summary: string; }; instruction: string; }[]; manifest: null; packageManager: { manager: null; reason: string; workspace: null; }; sourceCheckout?: never; }|{ npmProject: boolean; findings: { priority: number; problem: { type: string; summary: string; }; instruction: string; }[]; manifest: unknown; packageManager: { manager: null; reason: string; workspace: boolean|null; }|{ manager: string; reason: null; workspace: boolean; }; sourceCheckout: boolean; }>; (): Promise<{ ok: boolean; problem: { type: string; summary: string; }; instruction: string; digest?: never; }|{ ok: boolean; problem: { type: string; summary: string; }; instruction?: never; digest?: never; }|{ ok: boolean; digest: unknown; problem?: never; instruction?: never; }>; (): Promise<{ branch: unknown; changes: unknown; head: unknown; observation: unknown; instructions: unknown; ready: boolean; }|{ branch: unknown; changes: unknown; head: unknown; observation: unknown; ready: boolean; instructions?: never; }|{ branch: unknown; head: unknown; observation: unknown; primary: unknown; ready: boolean; instructions?: never; }|{ branch: unknown; head: unknown; observation: unknown; primary: unknown; instructions: string; ready: boolean; }|{ observation: unknown; instructions: string; ready: boolean; }>; (): Promise<{ branch: unknown; changes: unknown; head: unknown; observation: unknown; instructions: unknown; ready: boolean; }|{ branch: unknown; changes: unknown; head: unknown; observation: unknown; ready: boolean; instructions?: never; }|{ branch: unknown; head: unknown; observation: unknown; primary: unknown; ready: boolean; instructions?: never; }|{ branch: unknown; head: unknown; observation: unknown; primary: unknown; instructions: string; ready: boolean; }|{ observation: unknown; instructions: string; ready: boolean; }>; (): Promise<{ state: string; diagnostics: { code: string; level: string; path: string; message: string; remediation: string; }[]; }>; (): Promise<{ state: string; diagnostics: { code: string; level: string; path: string; message: string; remediation: string; }[]; }>; (): Promise<{ runtime: { source: string; executable: string|null; version: unknown; globalInstallationPresent: boolean; }; globalConfig: { path: string; present: boolean; valid: boolean; }; diagnostics: { code: string; level: string; path: string; message: string; remediation: string; }[]; user: { config: unknown; configPath: string; diagnostics: { code: string; level: string; path: string; message: string; remediation: string; }[]; }; }>; (): Promise<{ device: unknown; config: unknown; findings: unknown[]; gitReady: boolean; instructions: unknown[]; problems: unknown[]; root: string; skill: unknown; }>; (): Promise<{ project: unknown; diagnostics: { code: unknown; level: string; path: unknown; message: unknown; remediation: unknown; }[]; ideas: { state: string; status: unknown; statusPath: string; ledgerPath: string; worlds: { idealRevision: { name: string; displayName: string; path: string; documentPath: string; }; implementationRevision: { name: string; displayName: string; path: string; documentPath: string; }; deploymentRevision: { name: string; displayName: string; path: string; documentPath: string; }; }; idealRevision: unknown; implementationRevision: unknown; deploymentRevision: unknown; id: string; path: string; relativePath: string; revisions: { idealRevision: unknown; implementationRevision: unknown; deploymentRevision: unknown; }; }[]; }>; (): Promise<{ config: unknown; contentLanguage: unknown; findings: { priority: unknown; problem: { type: unknown; summary: string; }; instruction: string; }[]; layout: unknown; observation: { state: string; observedThrough: string; root: unknown; outputLanguage: unknown; problems: unknown; version?: never; configuration?: never; ideas?: never; }|{ state: string; observedThrough: string; root: unknown; version: unknown; outputLanguage: unknown; problems: unknown; configuration?: never; ideas?: never; }|{ state: string; observedThrough: string; root: unknown; version: unknown; configuration: unknown; outputLanguage: unknown; problems: unknown; ideas?: never; }|{ state: string; observedThrough: string; root: unknown; version: unknown; configuration: unknown; ideas: unknown; outputLanguage: unknown; problems: unknown; }; outputLanguage: string; outputLanguageOverride: string|undefined; projectReady: boolean; }|{ config: unknown; contentLanguage: unknown; findings: { priority: unknown; problem: { type: unknown; summary: string; }; instruction: string; }[]; layout: unknown; observation: { state: string; root: unknown; version: unknown; configuration: { primaryRepository: unknown; primaryBranch: unknown; preferredLanguage: unknown; }; ideas: { counts: { [k: string]: number; }; activeIdeas: { id: unknown; state: unknown; }[]; }; outputLanguage: string; problems: never[]; }; outputLanguage: string; outputLanguageOverride: string|undefined; projectReady: boolean; }>; (): Promise<{ status: string; result: unknown; facts: unknown; }|{ status: string; problem: unknown; facts: unknown; internal: unknown; }>; (): Promise<{ inventory: { summary: { matched: number; returned: number; truncated: boolean; counts: { [k: string]: unknown; }; }; ideas: unknown[]; }; queryCandidateCount: number; titleReadCount: number; }>; (): Promise<unknown[]>; (): Promise<void>; (): Promise<unknown>; (): unknown; },
  summarize: (result: unknown) => TraceSummary = () => ({}),
) {
  const context = traceContext.getStore();
  if (!context) return callback();

  const span = context.trace.start(name, context.parentSpanId, attributes);
  return traceContext.run(
    { parentSpanId: span.id, trace: context.trace },
    async () => {
      try {
        const result = await callback();
        const summary = summarize(result);
        context.trace.end(
          span,
          summary.status ?? "ok",
          summary.attributes ?? {},
        );
        return result;
      } catch (caught) {
        context.trace.end(span, "error", { errorName: errorName(caught) });
        throw caught;
      }
    },
  );
}

export async function traceAsync<T>(
  name: string,
  attributes: TraceAttributes,
  callback: () => T | Promise<T>,
  summarize: (result: T) => TraceSummary = () => ({}),
): Promise<T> {
  const context = traceContext.getStore();
  if (!context) return callback();

  const span = context.trace.start(name, context.parentSpanId, attributes);
  return traceContext.run(
    { parentSpanId: span.id, trace: context.trace },
    async () => {
      try {
        const result = await callback();
        const summary = summarize(result);
        context.trace.end(
          span,
          summary.status ?? "ok",
          summary.attributes ?? {},
        );
        return result;
      } catch (caught) {
        context.trace.end(span, "error", { errorName: errorName(caught) });
        throw caught;
      }
    },
  );
}

function hash(value: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function projectDomainMessage(message: Record<string, unknown>) {
  const base = {
    channel: "domain",
    event: message.type,
    messageSequence: message.sequence,
  };
  if (message.type === "intention.accepted") {
    if (!isRecord(message.intention)) throw new TypeError("Invalid traced intention");
    return {
      ...base,
      command: message.intention.command,
      argumentNames: Object.keys(message.intention.args ?? {}).sort(),
      intentionHash: hash(message.intention),
    };
  }
  if (message.type === "observation.fact") {
    if (!isRecord(message.fact) || !isRecord(message.fact.observation)) {
      throw new TypeError("Invalid traced observation fact");
    }
    const observation = message.fact.observation;
    const problems = Array.isArray(observation.problems) ? observation.problems : [];
    const selectedIdea = isRecord(observation.selectedIdea) ? observation.selectedIdea : undefined;
    const createdIdea = isRecord(observation.createdIdea) ? observation.createdIdea : undefined;
    return {
      ...base,
      factType: message.fact.type,
      progress: message.fact.progress,
      state: observation.state,
      problemCount: problems.length,
      problemTypes: problems.map((problem) => isRecord(problem) ? problem.type : undefined),
      ...(selectedIdea?.id === undefined
        ? {}
        : { selectedIdeaId: selectedIdea.id }),
      ...(createdIdea?.id === undefined
        ? {}
        : { createdIdeaId: createdIdea.id }),
    };
  }
  if (message.type === "action.requested") {
    if (!isRecord(message.action)) throw new TypeError("Invalid traced action");
    return {
      ...base,
      actionId: message.actionId,
      actionType: message.action.type,
    };
  }
  if (message.type === "action.finished") {
    const problem = isRecord(message.problem) ? message.problem : undefined;
    const result = isRecord(message.result) ? message.result : {};
    return {
      ...base,
      actionId: message.actionId,
      actionType: message.actionType,
      status: message.status,
      ...(problem?.type === undefined
        ? {}
        : { problemType: problem.type }),
      resultFields: Object.keys(result).sort(),
    };
  }
  if (message.type === "response.created") {
    if (!isRecord(message.metadata)) throw new TypeError("Invalid traced response metadata");
    return {
      ...base,
      kind: message.kind,
      responseHash: message.metadata.hash,
      nextStepCount: message.metadata.nextStepCount,
      itemCount: message.metadata.itemCount,
    };
  }
  throw new Error(`Cannot trace unknown domain message type: ${message.type}`);
}

export function emitDomainMessage(message: unknown) {
  const context = traceContext.getStore();
  if (!context) return;
  if (!isRecord(message)) throw new TypeError("Invalid traced domain message");
  context.trace.emit(projectDomainMessage(message));
}

export function traceSync<T>(
  name: string,
  attributes: TraceAttributes,
  callback: () => T,
  summarize: (result: T) => TraceSummary = () => ({}),
): T {
  const context = traceContext.getStore();
  if (!context) return callback();

  const span = context.trace.start(name, context.parentSpanId, attributes);
  return traceContext.run(
    { parentSpanId: span.id, trace: context.trace },
    () => {
      try {
        const result = callback();
        const summary = summarize(result);
        context.trace.end(
          span,
          summary.status ?? "ok",
          summary.attributes ?? {},
        );
        return result;
      } catch (caught) {
        context.trace.end(span, "error", { errorName: errorName(caught) });
        throw caught;
      }
    },
  );
}

async function flushTrace(path: string, trace: Trace) {
  const span = trace.start("trace.flush", null, {});
  let handle;
  let failure;
  let spanEnded = false;
  try {
    handle = await open(path, "wx");
    await handle.writeFile(trace.serialize(), { encoding: "utf8" });
    await handle.sync();
    trace.end(span, "ok", { eventCount: trace.events.length + 1 });
    spanEnded = true;
    await handle.appendFile(
      `${JSON.stringify(trace.events.at(-1))}\n`,
      { encoding: "utf8" },
    );
    await handle.sync();
  } catch (caught) {
    if (!spanEnded) {
      trace.end(span, "error", { errorName: errorName(caught) });
    }
    failure = caught;
  }

  if (handle) {
    try {
      await handle.close();
    } catch (caught) {
      failure = failure
        ? new AggregateError([failure, caught], `Cannot close trace file: ${path}`)
        : caught;
    }
  }
  if (failure) throw failure;
}

export async function withTraceFile<T>(
  file: string | undefined,
  name: string,
  attributes: TraceAttributes,
  callback: () => T | Promise<T>,
): Promise<T> {
  if (file === undefined) return callback();

  const path = resolve(file);
  await requireAvailableTracePath(path);
  const trace = new Trace();
  let outcome: { ok: true; value: T } | { ok: false; error: unknown };
  try {
    const value = await traceContext.run(
      { parentSpanId: null, trace },
      () => traceAsync(name, attributes, callback),
    );
    outcome = { ok: true, value };
  } catch (caught) {
    outcome = { ok: false, error: caught };
  }

  let traceError;
  try {
    await flushTrace(path, trace);
  } catch (caught) {
    traceError = caught;
  }

  if (!outcome.ok && traceError) {
    throw new AggregateError(
      [outcome.error, traceError],
      `Command failed and trace file could not be written: ${path}`,
    );
  }
  if (!outcome.ok) throw outcome.error;
  if (traceError) {
    const message = traceError instanceof Error ? traceError.message : String(traceError);
    throw new Error(`Cannot write trace file ${path}: ${message}`, {
      cause: traceError,
    });
  }
  return outcome.value;
}
