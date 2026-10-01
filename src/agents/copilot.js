import { createHash } from "node:crypto";
import { CopilotClient } from "@github/copilot-sdk";

import { canonicalRoute, LocalProjectRegistry } from "./project-registry.js";

export { LocalProjectRegistry } from "./project-registry.js";

class EventQueue {
  #values = [];
  #waiting;
  #error;
  #closed = false;

  push(value) {
    if (this.#closed || this.#error) return;
    if (this.#waiting) {
      const resolve = this.#waiting;
      this.#waiting = undefined;
      resolve.resolve({ value, done: false });
    } else {
      this.#values.push(value);
    }
  }

  fail(error) {
    this.#error = error;
    if (this.#waiting) {
      const resolve = this.#waiting;
      this.#waiting = undefined;
      resolve.reject(error);
    }
  }

  close() {
    this.#closed = true;
    this.#values.length = 0;
    if (this.#waiting) {
      this.#waiting.resolve({ done: true });
      this.#waiting = undefined;
    }
  }

  async next() {
    if (this.#values.length) return { value: this.#values.shift(), done: false };
    if (this.#error) throw this.#error;
    if (this.#closed) return { done: true };
    return new Promise((resolve, reject) => { this.#waiting = { resolve, reject }; });
  }
}

function subscribe(set, initial, fault) {
  const queue = new EventQueue();
  set.add(queue);
  if (initial) queue.push(initial);
  if (fault) queue.fail(fault);
  return {
    [Symbol.asyncIterator]() { return this; },
    next: () => queue.next(),
    async return() {
      set.delete(queue);
      queue.close();
      return { done: true };
    },
  };
}

function formatDetail(value) {
  return typeof value === "string" ? value : JSON.stringify(value);
}

function failReplies(entry, reason) {
  entry.fault = new Error(reason);
  for (const queue of entry.replies) queue.fail(entry.fault);
  entry.replies.clear();
  entry.lastMessage = undefined;
}

function onSessionEvent(entry, event) {
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
      failReplies(entry, entry.state.reason);
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
    const base = { toolCallId: data.toolCallId, name: data.toolName ?? "unknown" };
    const state = type === "tool.execution_start" ? "started" : data.success ? "succeeded" : "failed";
    const detail = type === "tool.execution_start" ? data.arguments
      : data.success ? data.result : data.error;
    const value = formatDetail(detail);
    const observation = value === undefined
      ? { type: "tool", ...base, state }
      : { type: "toolDetails", ...base, state, [state === "started" ? "input" : state === "succeeded" ? "output" : "error"]: value };
    for (const queue of entry.observers) queue.push(observation);
  }
}

function routeId(route) {
  const suffix = createHash("sha256").update(route.projectUrl).digest("hex").slice(0, 16);
  return `silvermoon-${route.ideaId}-${suffix}`;
}

export class CopilotAdapter {
  #client;
  #registry;
  #permission;
  #routes = new Map();
  #starting = new Map();
  #clientStart;
  #ownsClient;
  #closed = false;

  constructor(options = {}) {
    const { client = new CopilotClient(), registry = new LocalProjectRegistry(), onPermissionRequest } = options;
    if (typeof onPermissionRequest !== "function") {
      throw new TypeError("CopilotAdapter requires an explicit onPermissionRequest handler.");
    }
    this.#client = client;
    this.#registry = registry;
    this.#ownsClient = options.client === undefined;
    this.#permission = onPermissionRequest;
  }

  async capabilities() {
    return { resumeSession: true, observation: "activityDetails", sendWhileRunning: true };
  }

  async start(route) {
    if (this.#closed) throw new Error("CopilotAdapter is closed.");
    const identified = canonicalRoute(route);
    const id = routeId(identified);
    const active = this.#routes.get(id);
    if (active?.fault) throw active.fault;
    if (active) return;
    if (this.#starting.has(id)) return this.#starting.get(id);
    const pending = this.#startSession(identified, id);
    this.#starting.set(id, pending);
    try {
      await pending;
    } finally {
      this.#starting.delete(id);
    }
  }

  async #startSession(identified, id) {
    const release = await this.#registry.acquire(identified);
    try {
      await this.#connectSession(identified, id, release);
    } catch (error) {
      await release();
      throw error;
    }
  }

  async #connectSession(identified, id, release) {
    const worktreePath = await this.#registry.resolve(identified);
    this.#clientStart ??= this.#client.start();
    await this.#clientStart;
    const sessions = await this.#client.listSessions();
    const existing = sessions.find(({ sessionId }) => sessionId === id);
    if (existing?.context?.cwd && existing.context.cwd !== worktreePath) {
      throw new Error("Copilot session is bound to a different worktree; explicit relocation is required.");
    }
    const previouslyBound = await this.#registry.sessionBinding(identified, id, worktreePath);
    if (previouslyBound && !existing) {
      throw new Error("The previously bound Copilot session is not listed; verify its state before explicit recovery.");
    }
    const entry = {
      observers: new Set(), replies: new Set(),
      state: { type: "session", state: "unknown", reason: "No current execution status has been observed." },
      lastMessage: undefined, fault: undefined, release,
    };
    // A failed create or resume is ambiguous: never silently create another session.
    entry.session = existing
      ? await this.#client.resumeSession(id, { workingDirectory: worktreePath, onPermissionRequest: this.#permission })
      : await this.#client.createSession({ sessionId: id, workingDirectory: worktreePath, onPermissionRequest: this.#permission });
    entry.unsubscribe = entry.session.on((event) => onSessionEvent(entry, event));
    this.#routes.set(id, entry);
  }

  async close() {
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
    const failed = starting.filter(({ status }) => status === "rejected");
    if (failed.length) throw new AggregateError(failed.map(({ reason }) => reason), "CopilotAdapter could not start every session.");
  }

  async #entry(route) {
    const id = routeId(canonicalRoute(route));
    const entry = this.#routes.get(id);
    if (!entry) throw new Error("Start the Copilot session before using this route.");
    return entry;
  }

  #stream(route, kind) {
    let iterator;
    let cancelled = false;
    const ready = this.#entry(route).then((entry) => {
      iterator = subscribe(entry[kind], kind === "observers" ? entry.state : undefined,
        kind === "replies" ? entry.fault : undefined);
      if (cancelled) return iterator.return().then(() => iterator);
      return iterator;
    });
    return {
      [Symbol.asyncIterator]() { return this; },
      async next() { return (await ready).next(); },
      async return() {
        cancelled = true;
        await (await ready).return();
        return { done: true };
      },
    };
  }

  observe(route) {
    return this.#stream(route, "observers");
  }

  async *send(route, message) {
    if (typeof message !== "string" || !message.trim()) throw new TypeError("message must be nonempty.");
    const entry = await this.#entry(route);
    if (entry.fault) {
      yield { state: "unknown", reason: `Copilot session cannot accept another message: ${entry.fault.message}` };
      return;
    }
    try {
      await entry.session.send({ prompt: message, mode: "immediate" });
    } catch (error) {
      const reason = `Copilot send failed; delivery cannot be confirmed: ${error.message}`;
      entry.state = { type: "session", state: "unknown", reason };
      for (const queue of entry.observers) queue.push(entry.state);
      failReplies(entry, reason);
      yield { state: "unknown", reason };
      return;
    }
    yield { state: "queued", boundary: "Copilot accepted the message; immediate steering may become queued." };
    yield { state: "unknown", reason: "Copilot does not confirm per-message consumption; observe the session and final reply." };
  }

  events(route) {
    return this.#stream(route, "replies");
  }
}
