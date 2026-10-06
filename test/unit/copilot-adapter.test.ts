import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  CopilotClient, CopilotSession, type MessageOptions, type SessionEvent,
} from "@github/copilot-sdk";
import {
  CopilotAdapter, LocalProjectRegistry,
} from "../../src/business/agent-copilot.ts";

const IDEA = "01M3SK3CGZF47A36D2GWN8BFPC";
async function nextWithin<T>(iterator: AsyncIterator<T>): Promise<IteratorResult<T>> {
  return Promise.race<IteratorResult<T>>([
    iterator.next(),
    new Promise<IteratorResult<T>>((_, reject) =>
      setTimeout(() => reject(new Error("Missing observation")), 1000)),
  ]);
}

function first<T>(values: Iterable<T>): T {
  const value = values[Symbol.iterator]().next();
  assert.equal(value.done, false);
  return value.value;
}

class FakeSession extends CopilotSession {
  #handlers = new Set<(event: SessionEvent) => void>();
  messages: unknown[] = [];
  sendError: Error | undefined;
  worktreePath = "";

  constructor(sessionId: string) {
    super();
    Object.defineProperty(this, "sessionId", { value: sessionId });
  }

  override on(handler: (event: SessionEvent) => void) {
    this.#handlers.add(handler);
    return () => this.#handlers.delete(handler);
  }

  override async send(options: string | MessageOptions) {
    if (this.sendError) throw this.sendError;
    this.messages.push(options);
    return `message-${this.messages.length}`;
  }

  override async disconnect() {}

  emit(type: SessionEvent["type"], data: Record<string, unknown> = {}, agentId?: string) {
    const event = { type, data, ...(agentId === undefined ? {} : { agentId }) };
    for (const handler of this.#handlers) {
      if (isSessionEvent(event)) handler(event);
    }
  }
}

function isSessionEvent(value: unknown): value is SessionEvent {
  return typeof value === "object" && value !== null
    && "type" in value && typeof value.type === "string"
    && "data" in value && typeof value.data === "object" && value.data !== null;
}

class FakeClient extends CopilotClient {
  sessionFixtures = new Map<string, FakeSession>();
  creates = 0;
  resumes = 0;
  omitContext = false;
  startError: Error | undefined;
  createError: Error | undefined;

  override async start() {
    if (this.startError) throw this.startError;
  }

  override async listSessions() {
    const timestamp = new Date(0);
    return [...this.sessionFixtures.entries()].map(([sessionId, session]) => ({
      sessionId,
      startTime: timestamp,
      modifiedTime: timestamp,
      isRemote: false,
      ...(this.omitContext ? {} : { context: { workingDirectory: session.worktreePath } }),
    }));
  }

  override async createSession(config: Parameters<CopilotClient["createSession"]>[0]) {
    this.creates++;
    if (this.createError) throw this.createError;
    const { sessionId, workingDirectory } = config;
    if (typeof sessionId !== "string" || typeof workingDirectory !== "string") {
      throw new TypeError("Fake session fixtures require an ID and working directory.");
    }
    const session = new FakeSession(sessionId);
    session.worktreePath = workingDirectory;
    this.sessionFixtures.set(sessionId, session);
    return session;
  }

  override async resumeSession(
    id: string,
    _config: Parameters<CopilotClient["resumeSession"]>[1],
  ) {
    this.resumes++;
    const session = this.sessionFixtures.get(id);
    if (!session) throw new Error(`Unknown fake session ${id}`);
    return session;
  }
}

type Route = { projectUrl: string; ideaId: string };
class Registry extends LocalProjectRegistry {
  bindings = new Set<string>();
  bindSessions = true;
  private readonly worktreePath: string;

  constructor(worktreePath: string) {
    super({ root: worktreePath });
    this.worktreePath = worktreePath;
  }

  override async resolve() {
    return this.worktreePath;
  }

  override async acquire() {
    return async () => {};
  }

  override async sessionBinding(
    route: Route,
    sessionId: string,
    _worktreePath: string,
    options?: { createIfMissing?: boolean },
  ) {
    void route;
    if (!this.bindSessions) return false;
    const exists = this.bindings.has(sessionId);
    if (options?.createIfMissing ?? true) this.bindings.add(sessionId);
    return exists;
  }
}

async function fixture(fn: (context: {
  adapter: CopilotAdapter;
  client: FakeClient;
  registry: Registry;
  route: Route;
}) => Promise<void>) {
  const worktreePath = await mkdtemp(join(tmpdir(), "silvermoon-agent-"));
  try {
    const client = new FakeClient();
    const registry = new Registry(worktreePath);
    const adapter = new CopilotAdapter({ client, registry, onPermissionRequest: () => ({ kind: "reject" }) });
    const route = { projectUrl: "https://github.com/example/project.git", ideaId: IDEA };
    await fn({ adapter, client, registry, route });
  } finally {
    await rm(worktreePath, { recursive: true });
  }
}

test("requires explicit permission handling and a valid route", async () => {
  assert.throws(() => Reflect.construct(CopilotAdapter, []), /onPermissionRequest/);
  await fixture(async ({ adapter, route }) => {
    await assert.rejects(adapter.start({ ...route, ideaId: "not-an-idea" }), TypeError);
    assert.equal((await adapter.capabilities()).observation, "activityDetails");
  });
});

test("an authentication startup error is surfaced without creating a session", async () => {
  await fixture(async ({ adapter, client, route }) => {
    client.startError = new Error("Copilot authentication unavailable");
    await assert.rejects(adapter.start(route), /authentication unavailable/);
    assert.equal(client.creates, 0);
  });
});

test("one adapter isolates routes and recovers the same persisted session", async () => {
  await fixture(async ({ adapter, client, registry, route }) => {
    const second = await mkdtemp(join(tmpdir(), "silvermoon-agent-"));
    try {
      await Promise.all([adapter.start(route), adapter.start(route)]);
      assert.equal(client.creates, 1);
      const other = { ...route, ideaId: "01M3SK3CGZF47A36D2GWN8BFPD" };
      await adapter.start(other);
      assert.equal(client.creates, 2);
      const replacement = new CopilotAdapter({ client, registry, onPermissionRequest: () => ({ kind: "reject" }) });
      await replacement.start(route);
      assert.equal(client.resumes, 1);
      assert.equal(client.creates, 2);
      first(client.sessionFixtures.values()).worktreePath = second;
      const relocated = new CopilotAdapter({ client, registry, onPermissionRequest: () => ({ kind: "reject" }) });
      await assert.rejects(relocated.start(route), /explicit relocation/);
    } finally {
      await rm(second, { recursive: true });
    }
  });
});

test("never creates a replacement when a previously bound session is not listed", async () => {
  await fixture(async ({ adapter, client, registry, route }) => {
    await adapter.start(route);
    const original = first(client.sessionFixtures.keys());
    client.sessionFixtures.delete(original);
    const replacement = new CopilotAdapter({ client, registry, onPermissionRequest: () => ({ kind: "reject" }) });
    await assert.rejects(replacement.start(route), /previously bound Copilot session is not listed/);
    assert.equal(client.creates, 1);
    assert.equal(client.resumes, 0);
  });
});

test("an ambiguous creation failure retains the binding until explicit recovery", async () => {
  await fixture(async ({ adapter, client, registry, route }) => {
    client.createError = new Error("connection failed after request");
    await assert.rejects(adapter.start(route), /connection failed/);
    client.createError = undefined;
    const replacement = new CopilotAdapter({ client, registry, onPermissionRequest: () => ({ kind: "reject" }) });
    await assert.rejects(replacement.start(route), /previously bound Copilot session is not listed/);
    assert.equal(client.creates, 1);
  });
});

test("an unbound existing session without workspace metadata is not adopted", async () => {
  await fixture(async ({ adapter, client, registry, route }) => {
    await adapter.start(route);
    client.omitContext = true;
    const unboundRegistry = new Registry(await registry.resolve());
    unboundRegistry.bindSessions = false;
    const unbound = new CopilotAdapter({
      client,
      registry: unboundRegistry,
      onPermissionRequest: () => ({ kind: "reject" }),
    });
    await assert.rejects(unbound.start(route), /workspace cannot be verified/);
    assert.equal(client.resumes, 0);
    const trusted = new CopilotAdapter({ client, registry, onPermissionRequest: () => ({ kind: "reject" }) });
    await trusted.start(route);
    assert.equal(client.resumes, 1);
  });
});

test("keeps process messages separate from the final idle reply", async () => {
  await fixture(async ({ adapter, client, route }) => {
    await adapter.start(route);
    const session = first(client.sessionFixtures.values());
    const observations = adapter.observe(route)[Symbol.asyncIterator]();
    const replies = adapter.events(route)[Symbol.asyncIterator]();
    assert.equal((await nextWithin(observations)).value.state, "unknown");
    const waiting = replies.next();
    await new Promise((resolve) => setImmediate(resolve));
    session.emit("assistant.turn_start");
    assert.equal((await nextWithin(observations)).value.state, "running");
    session.emit("assistant.message", { content: "Checking tools" });
    assert.equal((await nextWithin(observations)).value.text, "Checking tools");
    session.emit("tool.execution_start", { toolCallId: "a", toolName: "safe", arguments: { x: 1 } });
    assert.deepEqual((await nextWithin(observations)).value, {
      type: "toolDetails", toolCallId: "a", name: "safe", state: "started", input: '{"x":1}',
    });
    session.emit("tool.execution_complete", { toolCallId: "a", success: true, result: "done" });
    assert.deepEqual((await nextWithin(observations)).value, {
      type: "toolDetails", toolCallId: "a", name: "safe", state: "succeeded", output: "done",
    });
    session.emit("assistant.message", { content: "FINAL" });
    assert.equal((await nextWithin(observations)).value.text, "FINAL");
    session.emit("session.idle");
    assert.equal((await nextWithin(observations)).value.state, "idle");
    const finalReply = await Promise.race<IteratorResult<string>>([
      waiting,
      new Promise<IteratorResult<string>>((_, reject) =>
        setTimeout(() => reject(new Error("Missing reply")), 1000)),
    ]);
    assert.equal(finalReply.value, "FINAL");
    if (observations.return) await observations.return();
    if (replies.return) await replies.return();
  });
});

test("reports send acceptance without claiming per-message processing", async () => {
  await fixture(async ({ adapter, client, route }) => {
    await adapter.start(route);
    const deliveries = [];
    for await (const item of adapter.send(route, "new instruction")) deliveries.push(item);
    assert.deepEqual(deliveries.map(({ state }) => state), ["queued", "unknown"]);
    const sent = first(first(client.sessionFixtures.values()).messages);
    assert.equal(
      typeof sent === "object" && sent !== null && "mode" in sent ? sent.mode : undefined,
      "immediate",
    );
    await assert.rejects(async () => {
      for await (const item of adapter.send(route, " ")) void item;
    }, TypeError);
  });
});

test("an uncertain send invalidates observed state and does not permit blind retry", async () => {
  await fixture(async ({ adapter, client, route }) => {
    await adapter.start(route);
    const session = first(client.sessionFixtures.values());
    session.emit("session.idle");
    const observations = adapter.observe(route)[Symbol.asyncIterator]();
    assert.equal((await nextWithin(observations)).value.state, "idle");
    const replies = adapter.events(route)[Symbol.asyncIterator]();
    const pending = assert.rejects(replies.next(), /delivery cannot be confirmed/);
    await new Promise((resolve) => setImmediate(resolve));
    session.sendError = new Error("connection lost");
    const delivery = [];
    for await (const result of adapter.send(route, "first")) delivery.push(result);
    assert.deepEqual(delivery.map(({ state }) => state), ["unknown"]);
    assert.equal((await nextWithin(observations)).value.state, "unknown");
    await pending;
    session.sendError = undefined;
    const again = [];
    for await (const result of adapter.send(route, "first")) again.push(result);
    assert.deepEqual(again.map(({ state }) => state), ["unknown"]);
    assert.equal(session.messages.length, 0);
    if (observations.return) await observations.return();
    if (replies.return) await replies.return();
  });
});

for (const [eventType, data, state] of [
  ["session.idle", { aborted: true }, "unknown"],
  ["session.error", { message: "connection lost" }, "unknown"],
  ["session.shutdown", { shutdownType: "normal" }, "gone"],
] as const) {
  test(`${eventType} stops reply waiting without assuming the turn completed`, async () => {
    await fixture(async ({ adapter, client, route }) => {
      await adapter.start(route);
      const session = first(client.sessionFixtures.values());
      const observations = adapter.observe(route)[Symbol.asyncIterator]();
      const replies = adapter.events(route)[Symbol.asyncIterator]();
      await nextWithin(observations);
      const pending = assert.rejects(replies.next(), /aborted turn|connection lost|shut down/);
      await new Promise((resolve) => setImmediate(resolve));
      session.emit("assistant.message", { content: "unconfirmed reply" });
      session.emit(eventType, data);
      assert.equal((await nextWithin(observations)).value.type, "message");
      assert.equal((await nextWithin(observations)).value.state, state);
      await pending;
      session.emit("session.idle");
      await assert.rejects(
        nextWithin(adapter.events(route)[Symbol.asyncIterator]()),
        /aborted turn|connection lost|shut down/,
      );
      const deliveries = [];
      for await (const item of adapter.send(route, "do not replay")) deliveries.push(item);
      assert.equal(deliveries.length, 1);
      assert.equal(first(deliveries).state, "unknown");
      assert.equal(session.messages.length, 0);
      await assert.rejects(adapter.start(route), /aborted turn|connection lost|shut down/);
      if (observations.return) await observations.return();
      if (replies.return) await replies.return();
    });
  });
}
