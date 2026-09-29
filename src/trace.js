import { AsyncLocalStorage } from "node:async_hooks";
import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { access, lstat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export const TRACE_SCHEMA_VERSION = 2;
const traceContext = new AsyncLocalStorage();

function durationMilliseconds(started) {
  return Math.round(Number(process.hrtime.bigint() - started) / 1_000) / 1_000;
}

function errorName(caught) {
  return caught instanceof Error ? caught.name : typeof caught;
}

class Trace {
  constructor() {
    this.events = [];
    this.nextSequence = 1;
    this.nextSpanId = 1;
    this.traceId = randomUUID();
  }

  emit(event) {
    this.events.push({
      schemaVersion: TRACE_SCHEMA_VERSION,
      traceId: this.traceId,
      sequence: this.nextSequence,
      timestamp: new Date().toISOString(),
      ...event,
    });
    this.nextSequence += 1;
  }

  start(name, parentSpanId, attributes) {
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

  end(span, status, attributes = {}) {
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

async function requireAvailableTracePath(path) {
  const parent = dirname(path);
  const parentMetadata = await lstat(parent);
  if (!parentMetadata.isDirectory()) {
    throw new Error(`Trace parent is not a directory: ${parent}`);
  }
  await access(parent, constants.W_OK);
  try {
    await lstat(path);
  } catch (caught) {
    if (caught.code === "ENOENT") return;
    throw caught;
  }
  throw new Error(`Trace file already exists: ${path}`);
}

export async function traceAsync(
  name,
  attributes,
  callback,
  summarize = () => ({}),
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

function hash(value) {
  return createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex");
}

function projectDomainMessage(message) {
  const base = {
    channel: "domain",
    event: message.type,
    messageSequence: message.sequence,
  };
  if (message.type === "intention.accepted") {
    return {
      ...base,
      command: message.intention.command,
      argumentNames: Object.keys(message.intention.args ?? {}).sort(),
      intentionHash: hash(message.intention),
    };
  }
  if (message.type === "observation.fact") {
    return {
      ...base,
      factType: message.fact.type,
      progress: message.fact.progress,
      state: message.fact.observation.state,
      problemCount: message.fact.observation.problems?.length ?? 0,
      problemTypes: (message.fact.observation.problems ?? [])
        .map(({ type }) => type),
      ...(message.fact.observation.selectedIdea?.id === undefined
        ? {}
        : { selectedIdeaId: message.fact.observation.selectedIdea.id }),
      ...(message.fact.observation.createdIdea?.id === undefined
        ? {}
        : { createdIdeaId: message.fact.observation.createdIdea.id }),
    };
  }
  if (message.type === "action.requested") {
    return {
      ...base,
      actionId: message.actionId,
      actionType: message.action.type,
    };
  }
  if (message.type === "action.finished") {
    return {
      ...base,
      actionId: message.actionId,
      actionType: message.actionType,
      status: message.status,
      ...(message.problem?.type === undefined
        ? {}
        : { problemType: message.problem.type }),
      resultFields: Object.keys(message.result ?? {}).sort(),
    };
  }
  if (message.type === "response.created") {
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

export function emitDomainMessage(message) {
  const context = traceContext.getStore();
  if (!context) return;
  context.trace.emit(projectDomainMessage(message));
}

export function traceSync(name, attributes, callback, summarize = () => ({})) {
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

export async function withTraceFile(file, name, attributes, callback) {
  if (file === undefined) return callback();

  const path = resolve(file);
  await requireAvailableTracePath(path);
  const trace = new Trace();
  let result;
  let commandError;
  try {
    result = await traceContext.run(
      { parentSpanId: null, trace },
      () => traceAsync(name, attributes, callback),
    );
  } catch (caught) {
    commandError = caught;
  }

  let traceError;
  try {
    await writeFile(path, trace.serialize(), { encoding: "utf8", flag: "wx" });
  } catch (caught) {
    traceError = caught;
  }

  if (commandError && traceError) {
    throw new AggregateError(
      [commandError, traceError],
      `Command failed and trace file could not be written: ${path}`,
    );
  }
  if (commandError) throw commandError;
  if (traceError) {
    throw new Error(`Cannot write trace file ${path}: ${traceError.message}`, {
      cause: traceError,
    });
  }
  return result;
}
