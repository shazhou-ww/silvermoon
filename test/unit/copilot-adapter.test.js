import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { CopilotAdapter } from "../../src/agents/copilot.js";

const IDEA = "01M3SK3CGZF47A36D2GWN8BFPC";
async function nextWithin(iterator) {
  return Promise.race([
    iterator.next(),
    new Promise((_, reject) => setTimeout(() => reject(new Error("Missing observation")), 1000)),
  ]);
}

class FakeSession {
  #handlers = new Set();
  messages = [];

  constructor(sessionId) {
    this.sessionId = sessionId;
  }

  on(handler) {
    this.#handlers.add(handler);
    return () => this.#handlers.delete(handler);
  }

  async send(options) {
    if (this.sendError) throw this.sendError;
    this.messages.push(options);
    return `message-${this.messages.length}`;
  }

  async disconnect() {}

  emit(type, data = {}, agentId) {
    for (const handler of this.#handlers) handler({ type, data, agentId });
  }
}

class FakeClient {
  sessions = new Map();
  creates = 0;
  resumes = 0;

  async start() {}

  async listSessions() {
    return [...this.sessions.entries()].map(([sessionId, session]) => ({
      sessionId, context: { cwd: session.worktreePath },
    }));
  }

  async createSession(config) {
    this.creates++;
    if (this.createError) throw this.createError;
    const session = new FakeSession(config.sessionId);
    session.worktreePath = config.workingDirectory;
    this.sessions.set(config.sessionId, session);
    return session;
  }

  async resumeSession(id) {
    this.resumes++;
    return this.sessions.get(id);
  }
}

async function fixture(fn) {
  const worktreePath = await mkdtemp(join(tmpdir(), "silvermoon-agent-"));
  try {
    const client = new FakeClient();
    const bindings = new Set();
    const registry = {
      resolve: async () => worktreePath,
      acquire: async () => async () => {},
      sessionBinding: async (_, sessionId) => {
        const exists = bindings.has(sessionId);
        bindings.add(sessionId);
        return exists;
      },
    };
    const adapter = new CopilotAdapter({ client, registry, onPermissionRequest: () => ({ kind: "deny" }) });
    const route = { projectUrl: "https://github.com/example/project.git", ideaId: IDEA };
    await fn({ adapter, client, registry, route });
  } finally {
    await rm(worktreePath, { recursive: true });
  }
}

test("requires explicit permission handling and a valid route", async () => {
  assert.throws(() => new CopilotAdapter(), /onPermissionRequest/);
  await fixture(async ({ adapter, route }) => {
    await assert.rejects(adapter.start({ ...route, ideaId: "not-an-idea" }), TypeError);
    assert.equal((await adapter.capabilities()).observation, "activityDetails");
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
      const replacement = new CopilotAdapter({ client, registry, onPermissionRequest: () => ({ kind: "deny" }) });
      await replacement.start(route);
      assert.equal(client.resumes, 1);
      assert.equal(client.creates, 2);
      client.sessions.get([...client.sessions.keys()][0]).worktreePath = second;
      const relocated = new CopilotAdapter({ client, registry, onPermissionRequest: () => ({ kind: "deny" }) });
      await assert.rejects(relocated.start(route), /explicit relocation/);
    } finally {
      await rm(second, { recursive: true });
    }
  });
});

test("never creates a replacement when a previously bound session is not listed", async () => {
  await fixture(async ({ adapter, client, registry, route }) => {
    await adapter.start(route);
    const original = [...client.sessions.keys()][0];
    client.sessions.delete(original);
    const replacement = new CopilotAdapter({ client, registry, onPermissionRequest: () => ({ kind: "deny" }) });
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
    const replacement = new CopilotAdapter({ client, registry, onPermissionRequest: () => ({ kind: "deny" }) });
    await assert.rejects(replacement.start(route), /previously bound Copilot session is not listed/);
    assert.equal(client.creates, 1);
  });
});

test("keeps process messages separate from the final idle reply", async () => {
  await fixture(async ({ adapter, client, route }) => {
    await adapter.start(route);
    const session = [...client.sessions.values()][0];
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
    session.emit("assistant.message", { content: "FINAL" });
    assert.equal((await nextWithin(observations)).value.text, "FINAL");
    session.emit("session.idle");
    assert.equal((await nextWithin(observations)).value.state, "idle");
    assert.equal((await Promise.race([waiting, new Promise((_, reject) => setTimeout(() => reject(new Error("Missing reply")), 1000))])).value, "FINAL");
    await observations.return();
    await replies.return();
  });
});

test("reports send acceptance without claiming per-message processing", async () => {
  await fixture(async ({ adapter, client, route }) => {
    await adapter.start(route);
    const deliveries = [];
    for await (const item of adapter.send(route, "new instruction")) deliveries.push(item);
    assert.deepEqual(deliveries.map(({ state }) => state), ["queued", "unknown"]);
    assert.equal([...client.sessions.values()][0].messages[0].mode, "immediate");
    await assert.rejects(async () => {
      for await (const item of adapter.send(route, " ")) void item;
    }, TypeError);
  });
});

test("an uncertain send invalidates observed state and does not permit blind retry", async () => {
  await fixture(async ({ adapter, client, route }) => {
    await adapter.start(route);
    const session = [...client.sessions.values()][0];
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
    await observations.return();
    await replies.return();
  });
});

for (const [eventType, data, state] of [
  ["session.idle", { aborted: true }, "unknown"],
  ["session.error", { message: "connection lost" }, "unknown"],
  ["session.shutdown", { shutdownType: "normal" }, "gone"],
]) {
  test(`${eventType} stops reply waiting without assuming the turn completed`, async () => {
    await fixture(async ({ adapter, client, route }) => {
      await adapter.start(route);
      const session = [...client.sessions.values()][0];
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
      await assert.rejects(nextWithin(adapter.events(route)), /aborted turn|connection lost|shut down/);
      const deliveries = [];
      for await (const item of adapter.send(route, "do not replay")) deliveries.push(item);
      assert.equal(deliveries.length, 1);
      assert.equal(deliveries[0].state, "unknown");
      assert.equal(session.messages.length, 0);
      await assert.rejects(adapter.start(route), /aborted turn|connection lost|shut down/);
      await observations.return();
      await replies.return();
    });
  });
}
