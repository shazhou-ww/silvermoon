import { createHash } from "node:crypto";
import {
  CopilotClient,
  type CopilotSession,
  type PermissionHandler,
  type SessionEvent,
} from "@github/copilot-sdk";

import { canonicalRoute, LocalProjectRegistry } from "./agent-project-registry.ts";

export { LocalProjectRegistry } from "./agent-project-registry.ts";

export interface IdeaRoute {
  readonly projectUrl: string;
  readonly ideaId: string;
}

export interface AdapterCapabilities {
  readonly resumeSession: boolean;
  readonly observation: "session" | "activity" | "activityDetails";
  readonly sendWhileRunning: boolean;
}

export type Delivery =
  | { readonly state: "queued"; readonly boundary: string }
  | { readonly state: "delivered"; readonly boundary: string }
  | { readonly state: "processed"; readonly boundary: string }
  | { readonly state: "unknown"; readonly reason: string };

export type SessionObservation =
  | { readonly type: "session"; readonly state: "running" | "idle" | "gone" }
  | { readonly type: "session"; readonly state: "unknown"; readonly reason: string }
  | { readonly type: "message"; readonly text: string }
  | {
      readonly type: "tool";
      readonly toolCallId: string;
      readonly name: string;
      readonly state: "started" | "succeeded" | "failed";
    }
  | {
      readonly type: "toolDetails";
      readonly toolCallId: string;
      readonly name: string;
      readonly state: "started";
      readonly input: string;
    }
  | {
      readonly type: "toolDetails";
      readonly toolCallId: string;
      readonly name: string;
      readonly state: "succeeded";
      readonly output: string;
    }
  | {
      readonly type: "toolDetails";
      readonly toolCallId: string;
      readonly name: string;
      readonly state: "failed";
      readonly error: string;
    };

export interface AgentAdapter {
  capabilities(): Promise<AdapterCapabilities>;
  start(route: IdeaRoute): Promise<void>;
  observe(route: IdeaRoute): AsyncIterable<SessionObservation>;
  send(route: IdeaRoute, message: string): AsyncIterable<Delivery>;
  events(route: IdeaRoute): AsyncIterable<string>;
  close(): Promise<void>;
}

interface Waiting<T> {
  resolve(result: IteratorResult<T>): void;
  reject(error: unknown): void;
}

class EventQueue<T> implements AsyncIterator<T> {
  #values: T[] = [];
  #waiting: Waiting<T> | undefined;
  #error: unknown;
  #closed = false;

  push(value: T): void {
    if (this.#closed || this.#error) return;
    if (this.#waiting) {
      const resolve = this.#waiting;
      this.#waiting = undefined;
      resolve.resolve({ value, done: false });
    } else {
      this.#values.push(value);
    }
  }

  fail(error: unknown): void {
    this.#error = error;
    if (this.#waiting) {
      const resolve = this.#waiting;
      this.#waiting = undefined;
      resolve.reject(error);
    }
  }

  close(): void {
    this.#closed = true;
    this.#values.length = 0;
    if (this.#waiting) {
      this.#waiting.resolve({ value: undefined, done: true });
      this.#waiting = undefined;
    }
  }

  async next(): Promise<IteratorResult<T>> {
    if (this.#values.length) return { value: this.#values.shift()!, done: false };
    if (this.#error) throw this.#error;
    if (this.#closed) return { value: undefined, done: true };
    return new Promise<IteratorResult<T>>((resolve, reject) => { this.#waiting = { resolve, reject }; });
  }
}

function subscribe<T>(set: Set<EventQueue<T>>, initial?: T, fault?: unknown): AsyncIterableIterator<T> {
  const queue = new EventQueue<T>();
  set.add(queue);
  if (initial) queue.push(initial);
  if (fault) queue.fail(fault);
  return {
    [Symbol.asyncIterator]() { return this; },
    next: () => queue.next(),
    async return() {
      set.delete(queue);
      queue.close();
      return { value: undefined, done: true };
    },
  };
}

function streamEntry<T>(
  readyEntry: Promise<SessionEntry>,
  queues: (entry: SessionEntry) => Set<EventQueue<T>>,
  initial: (entry: SessionEntry) => T | undefined,
  fault: (entry: SessionEntry) => unknown,
): AsyncIterableIterator<T> {
  let cancelled = false;
  const ready = readyEntry.then(async (entry) => {
    const iterator = subscribe(queues(entry), initial(entry), fault(entry));
    if (cancelled) await iterator.return?.();
    return iterator;
  });
  return {
    [Symbol.asyncIterator]() { return this; },
    async next() { return (await ready).next(); },
    async return() {
      cancelled = true;
      await (await ready).return?.();
      return { value: undefined, done: true };
    },
  };
}

function formatDetail(value: unknown): string | undefined {
  return typeof value === "string" ? value : JSON.stringify(value);
}

type SessionState = Extract<SessionObservation, { type: "session" }>;

interface SessionEntry {
  observers: Set<EventQueue<SessionObservation>>;
  replies: Set<EventQueue<string>>;
  toolNames: Map<string, string>;
  state: SessionState;
  lastMessage: string | undefined;
  fault: Error | undefined;
  release: () => Promise<void>;
  session: CopilotSession;
  unsubscribe: () => void;
}

function failReplies(entry: SessionEntry, reason: string): void {
  entry.fault = new Error(reason);
  for (const queue of entry.replies) queue.fail(entry.fault);
  entry.replies.clear();
  entry.lastMessage = undefined;
  entry.toolNames.clear();
}

function onSessionEvent(entry: SessionEntry, event: SessionEvent): void {
  const { type, data } = event;
  if (entry.fault && type !== "session.shutdown") return;
  if (type === "assistant.turn_start" && !event.agentId) {
    entry.state = { type: "session", state: "running" };
    for (const queue of entry.observers) queue.push(entry.state);
  } else if (type === "assistant.message" && !event.agentId) {
    if (data.content?.trim()) {
      if (!data.toolRequests?.length) entry.lastMessage = data.content;
      for (const queue of entry.observers) queue.push({ type: "message", text: data.content });
    }
  } else if (type === "session.idle") {
    entry.state = data.aborted
      ? { type: "session", state: "unknown", reason: "Copilot reported an aborted turn." }
      : { type: "session", state: "idle" };
    for (const queue of entry.observers) queue.push(entry.state);
    if (data.aborted) {
      failReplies(entry, "Copilot reported an aborted turn.");
    } else if (entry.lastMessage) {
      for (const queue of entry.replies) queue.push(entry.lastMessage);
    }
    entry.lastMessage = undefined;
  } else if (type === "session.error") {
    entry.state = { type: "session", state: "unknown", reason: data.message };
    for (const queue of entry.observers) queue.push(entry.state);
    failReplies(entry, data.message);
  } else if (type === "session.shutdown") {
    entry.state = { type: "session", state: "gone" };
    for (const queue of entry.observers) queue.push(entry.state);
    failReplies(entry, "Copilot session shut down; replies may have been missed.");
  } else if (type === "tool.execution_start" || type === "tool.execution_complete") {
    if (type === "tool.execution_start") entry.lastMessage = undefined;
    if (type === "tool.execution_start" && data.toolName) {
      entry.toolNames.set(data.toolCallId, data.toolName);
    }
    const base = {
      toolCallId: data.toolCallId,
      name: (type === "tool.execution_start" ? data.toolName : undefined)
        ?? entry.toolNames.get(data.toolCallId) ?? "unknown",
    };
    if (type === "tool.execution_complete") entry.toolNames.delete(data.toolCallId);
    const detail = type === "tool.execution_start" ? data.arguments
      : data.success ? data.result : data.error;
    const value = formatDetail(detail);
    let observation: SessionObservation;
    if (value === undefined) {
      observation = {
        type: "tool",
        ...base,
        state: type === "tool.execution_start" ? "started" : data.success ? "succeeded" : "failed",
      };
    } else if (type === "tool.execution_start") {
      observation = { type: "toolDetails", ...base, state: "started", input: value };
    } else if (data.success) {
      observation = { type: "toolDetails", ...base, state: "succeeded", output: value };
    } else {
      observation = { type: "toolDetails", ...base, state: "failed", error: value };
    }
    for (const queue of entry.observers) queue.push(observation);
  }
}

function routeId(route: IdeaRoute): string {
  const suffix = createHash("sha256").update(route.projectUrl).digest("hex").slice(0, 16);
  return `silvermoon-${route.ideaId}-${suffix}`;
}

export class CopilotAdapter implements AgentAdapter {
  #client: CopilotClient;
  #registry: LocalProjectRegistry;
  #permission: PermissionHandler;
  #routes = new Map<string, SessionEntry>();
  #starting = new Map<string, Promise<void>>();
  #clientStart: Promise<void> | undefined;
  #ownsClient: boolean;
  #closed = false;

  constructor(options: {
    onPermissionRequest: PermissionHandler;
    client?: CopilotClient;
    registry?: LocalProjectRegistry;
  });
  constructor(options: {
    onPermissionRequest?: PermissionHandler;
    client?: CopilotClient;
    registry?: LocalProjectRegistry;
  } = {}) {
    const { client = new CopilotClient(), registry = new LocalProjectRegistry(), onPermissionRequest } = options;
    if (typeof onPermissionRequest !== "function") {
      throw new TypeError("CopilotAdapter requires an explicit onPermissionRequest handler.");
    }
    this.#client = client;
    this.#registry = registry;
    this.#ownsClient = options.client === undefined;
    this.#permission = onPermissionRequest;
  }

  async capabilities(): Promise<AdapterCapabilities> {
    return { resumeSession: true, observation: "activityDetails", sendWhileRunning: true };
  }

  async start(route: IdeaRoute): Promise<void> {
    if (this.#closed) throw new Error("CopilotAdapter is closed.");
    const identified = canonicalRoute(route);
    const id = routeId(identified);
    const active = this.#routes.get(id);
    if (active?.fault) throw active.fault;
    if (active) return;
    const starting = this.#starting.get(id);
    if (starting) return starting;
    const pending = this.#startSession(identified, id);
    this.#starting.set(id, pending);
    try {
      await pending;
    } finally {
      this.#starting.delete(id);
    }
  }

  async #startSession(identified: IdeaRoute, id: string): Promise<void> {
    const release = await this.#registry.acquire(identified);
    try {
      await this.#connectSession(identified, id, release);
    } catch (error) {
      await release();
      throw error;
    }
  }

  async #connectSession(
    identified: IdeaRoute,
    id: string,
    release: () => Promise<void>,
  ): Promise<void> {
    const worktreePath = await this.#registry.resolve(identified);
    this.#clientStart ??= this.#client.start();
    await this.#clientStart;
    const sessions = await this.#client.listSessions();
    const existing = sessions.find(({ sessionId }) => sessionId === id);
    if (existing?.context?.workingDirectory && existing.context.workingDirectory !== worktreePath) {
      throw new Error("Copilot session is bound to a different worktree; explicit relocation is required.");
    }
    const previouslyBound = await this.#registry.sessionBinding(identified, id, worktreePath, {
      createIfMissing: !existing || existing.context?.workingDirectory === worktreePath,
    });
    if (existing && !previouslyBound && existing.context?.workingDirectory !== worktreePath) {
      throw new Error("Copilot session workspace cannot be verified; explicit recovery is required.");
    }
    if (previouslyBound && !existing) {
      throw new Error("The previously bound Copilot session is not listed; verify its state before explicit recovery.");
    }
    const session = existing
      ? await this.#client.resumeSession(id, { workingDirectory: worktreePath, onPermissionRequest: this.#permission })
      : await this.#client.createSession({ sessionId: id, workingDirectory: worktreePath, onPermissionRequest: this.#permission });
    const entry: SessionEntry = {
      observers: new Set(), replies: new Set(),
      toolNames: new Map(),
      state: { type: "session", state: "unknown", reason: "No current execution status has been observed." },
      lastMessage: undefined, fault: undefined, release, session,
      unsubscribe: () => {},
    };
    // A failed create or resume is ambiguous: never silently create another session.
    entry.unsubscribe = entry.session.on((event) => onSessionEvent(entry, event));
    this.#routes.set(id, entry);
  }

  async close(): Promise<void> {
    if (this.#closed) return;
    this.#closed = true;
    const starting = await Promise.allSettled(this.#starting.values());
    try {
      await Promise.all([...this.#routes.values()].map(async (entry) => {
        try {
          entry.unsubscribe();
          for (const queue of [...entry.observers, ...entry.replies]) {
            queue.fail(new Error("CopilotAdapter is closed."));
          }
          await entry.session.disconnect();
        } finally {
          await entry.release();
        }
      }));
    } finally {
      this.#routes.clear();
      if (this.#ownsClient && this.#clientStart) await this.#client.stop();
    }
    const failed = starting.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    if (failed.length) throw new AggregateError(failed.map(({ reason }) => reason), "CopilotAdapter could not start every session.");
  }

  async #entry(route: IdeaRoute): Promise<SessionEntry> {
    const id = routeId(canonicalRoute(route));
    const entry = this.#routes.get(id);
    if (!entry) throw new Error("Start the Copilot session before using this route.");
    return entry;
  }

  observe(route: IdeaRoute): AsyncIterable<SessionObservation> {
    return streamEntry(
      this.#entry(route),
      (entry) => entry.observers,
      (entry) => entry.state,
      () => undefined,
    );
  }

  async *send(route: IdeaRoute, message: string): AsyncIterableIterator<Delivery> {
    if (typeof message !== "string" || !message.trim()) throw new TypeError("message must be nonempty.");
    const entry = await this.#entry(route);
    if (entry.fault) {
      yield { state: "unknown", reason: `Copilot session cannot accept another message: ${entry.fault.message}` };
      return;
    }
    try {
      await entry.session.send({ prompt: message, mode: "immediate" });
    } catch (error) {
      const reason = `Copilot send failed; delivery cannot be confirmed: ${error instanceof Error ? error.message : String(error)}`;
      entry.state = { type: "session", state: "unknown", reason };
      for (const queue of entry.observers) queue.push(entry.state);
      failReplies(entry, reason);
      yield { state: "unknown", reason };
      return;
    }
    yield { state: "queued", boundary: "Copilot accepted the message; immediate steering may become queued." };
    yield { state: "unknown", reason: "Copilot does not confirm per-message consumption; observe the session and final reply." };
  }

  events(route: IdeaRoute): AsyncIterable<string> {
    return streamEntry(
      this.#entry(route),
      (entry) => entry.replies,
      () => undefined,
      (entry) => entry.fault,
    );
  }
}
