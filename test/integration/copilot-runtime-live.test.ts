import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { CopilotClient, type Tool } from "@github/copilot-sdk";

import {
  CopilotAdapter,
  LocalProjectRegistry,
  type SessionObservation,
} from "../../src/business/agent-copilot.ts";
import {
  ProjectRuntime,
  type RuntimeResult,
} from "../../src/business/agent-project-runtime.ts";
import { migrateEvents } from "../../src/business/migrate-v1-to-v2.ts";
import { createRepository, FIRST_ID, git, PRIMARY_REPOSITORY } from "../helpers/repository.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function eventReceipt(result: RuntimeResult) {
  const receipt = result.report.observation.receipt;
  assert.ok(isRecord(receipt));
  assert.ok(typeof receipt.length === "number");
  assert.ok(typeof receipt.digest === "string");
  return { length: receipt.length, digest: receipt.digest };
}

function interactionState(result: RuntimeResult) {
  const receipt = result.report.observation.receipt;
  assert.ok(isRecord(receipt));
  const reduction = receipt.reduction;
  assert.ok(isRecord(reduction));
  const state = reduction.state;
  assert.ok(isRecord(state));
  const interaction = state.interaction;
  assert.ok(isRecord(interaction));
  assert.ok(typeof interaction.lastSignal === "string");
  assert.ok(Array.isArray(interaction.messages));
  const messages = interaction.messages.map((message) => {
    assert.ok(isRecord(message));
    assert.ok(typeof message.message === "string");
    return { message: message.message };
  });
  return { lastSignal: interaction.lastSignal, messages };
}

async function within<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Copilot did not respond within ${milliseconds}ms`)), milliseconds);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function nextOrTimeout(
  iterator: AsyncIterator<SessionObservation>,
  milliseconds: number,
): Promise<SessionObservation | null> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      iterator.next().then(({ value }) => value),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), milliseconds);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function collect<T>(values: AsyncIterable<T>): Promise<T[]> {
  const collected: T[] = [];
  for await (const value of values) collected.push(value);
  return collected;
}

async function liveProject() {
  const { base, root, repository } = await createRepository();
  const migration = await migrateEvents({ root });
  assert.ok("digest" in migration && typeof migration.digest === "string");
  await migrateEvents({ root, apply: true, expectedDigest: migration.digest });
  git(root, "add", ".");
  git(root, "commit", "-m", "Migrate fixture");
  git(root, "push", "origin", "HEAD:main");
  const projectUrl = `https://example.test/silvermoon-live/${randomUUID()}.git`;
  const configPath = join(root, ".silvermoon", "config.yaml");
  await writeFile(configPath, (await readFile(configPath, "utf8")).replace(PRIMARY_REPOSITORY, projectUrl));
  git(root, "remote", "set-url", "origin", projectUrl);
  git(root, "config", `url.${repository}.insteadOf`, projectUrl);
  git(root, "add", ".");
  git(root, "commit", "-m", "Isolate live project identity");
  git(root, "push", "origin", "HEAD:main");
  const registry = new LocalProjectRegistry({ root: join(base, "registry") });
  await registry.register(projectUrl, root);
  const route = { projectUrl, ideaId: FIRST_ID };
  return { base, root, registry, route, runtime: new ProjectRuntime({ registry }) };
}

test("real Copilot replies through the host-runtime interaction boundary", {
  skip: process.env.SILVERMOON_REAL_COPILOT !== "1",
  timeout: 120_000,
}, async (t) => {
  const { base, registry, route, runtime } = await liveProject();
  let adapter: CopilotAdapter;
  let replies: AsyncIterator<string>;
  t.after(async () => {
    try {
      if (replies?.return) await replies.return();
      if (adapter) await adapter.close();
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });
  adapter = new CopilotAdapter({
    registry,
    onPermissionRequest: () => ({ kind: "reject" }),
  });
  await adapter.start(route);
  replies = adapter.events(route)[Symbol.asyncIterator]();

  const messages: string[] = [];
  const round = async (token: string|RegExp, { expectToken = true } = {}) => {
    const prompt = `Reply with exactly the text ${token}. Do not use tools.`;
    const original = eventReceipt(await runtime.replay(route));
    const ping = await runtime.appendInteraction(route, {
      type: "ping", message: prompt, expectedLength: original.length, expectedDigest: original.digest,
    });
    assert.equal(ping.exitCode, 0);
    const deliveries = [];
    for await (const item of adapter.send(route, prompt)) deliveries.push(item.state);
    assert.deepEqual(deliveries, ["queued", "unknown"]);
    const reply = (await replies.next()).value;
    assert.ok(typeof reply === "string" && reply.trim());
    if (expectToken) assert.match(reply, new RegExp(token));
    const receipt = eventReceipt(await runtime.replay(route));
    const pong = await runtime.appendInteraction(route, {
      type: "pong", message: reply, expectedLength: receipt.length, expectedDigest: receipt.digest,
    });
    assert.equal(pong.exitCode, 0);
    messages.push(prompt, reply);
  };
  await round("SILVERMOON_TEST_READY");
  await round("SILVERMOON_TEST_AGAIN");
  await replies.return?.();
  await adapter.close();
  adapter = new CopilotAdapter({ registry, onPermissionRequest: () => ({ kind: "reject" }) });
  await adapter.start(route);
  replies = adapter.events(route)[Symbol.asyncIterator]();
  await round("SILVERMOON_TEST_RESUMED", { expectToken: false });
  const final = interactionState(await runtime.replay(route));
  assert.deepEqual(final.messages.map(({ message }) => message), messages);
  assert.equal(final.lastSignal, "pong");
});

test("real Copilot receives a diagnostic ping while a Git commit is blocked", {
  skip: process.env.SILVERMOON_REAL_COPILOT !== "1",
  timeout: 120_000,
}, async (t) => {
  const { base, registry, route, runtime } = await liveProject();
  const worktree = await registry.resolve(route);
  const initialCommit = git(worktree, "rev-parse", "HEAD");
  const hooks = join(base, "hooks");
  await mkdir(hooks);
  await writeFile(join(hooks, "pre-commit"), "#!/bin/sh\nprintf 'Fixture commit blocked\\n' >&2\nexit 1\n",
    { mode: 0o700 });
  let adapter: CopilotAdapter;
  let client: CopilotClient;
  let observations: AsyncIterator<SessionObservation>;
  let replies: AsyncIterator<string>;
  let releaseTool: (() => void) | undefined;
  t.after(async () => {
    if (releaseTool) releaseTool();
    if (observations?.return) await observations.return();
    if (replies?.return) await replies.return();
    if (adapter) await adapter.close();
    if (client) await client.stop();
    await rm(base, { recursive: true, force: true });
  });

  let toolStarted: () => void = () => {};
  const started = new Promise<void>((resolve) => { toolStarted = resolve; });
  let toolCalls = 0;
  const tool: Tool = {
    name: "silvermoon_git_probe",
    description: "Try a Git commit in the disposable project; its test hook rejects the commit.",
    parameters: {
      type: "object", properties: { request: { type: "string" } }, required: ["request"],
    },
    skipPermission: true,
    defer: "never",
    handler: async () => {
      toolCalls++;
      toolStarted();
      await new Promise<void>((resolve) => {
        releaseTool = () => resolve();
      });
      const attempt = spawnSync("git", [
        "-C", worktree, "-c", `core.hooksPath=${hooks}`,
        "commit", "--allow-empty", "-m", "Blocked fixture commit",
      ], { encoding: "utf8" });
      assert.equal(
        attempt.status,
        1,
        attempt.stderr || attempt.error?.message || "git commit unexpectedly failed",
      );
      assert.match(attempt.stderr, /Fixture commit blocked/);
      return "Commit blocked by fixture pre-commit hook; no commit was created.";
    },
  };
  client = new CopilotClient();
  const createSession = client.createSession.bind(client);
  let configured = false;
  client.createSession = (
    config: Parameters<CopilotClient["createSession"]>[0],
  ) => {
    configured = true;
    return createSession({ ...config, tools: [tool], availableTools: [tool.name] });
  };
  adapter = new CopilotAdapter({
    client,
    registry,
    onPermissionRequest: () => ({ kind: "reject" }),
  });
  await adapter.start(route);
  assert.equal(configured, true);
  replies = adapter.events(route)[Symbol.asyncIterator]();
  observations = adapter.observe(route)[Symbol.asyncIterator]();
  await observations.next();
  const first = "Call silvermoon_git_probe once, wait for its result, then explain the blocked Git commit.";
  const before = eventReceipt(await runtime.replay(route));
  assert.equal((await runtime.appendInteraction(route, {
    type: "ping", message: first, expectedLength: before.length, expectedDigest: before.digest,
  })).exitCode, 0);
  assert.deepEqual((await collect(adapter.send(route, first))).map(({ state }) => state), ["queued", "unknown"]);
  await within(started, 30_000);
  const followup = "Pause commit attempts, diagnose the failed Git commit and include SILVERMOON_GIT_DIAGNOSIS. Do not call tools.";
  const observed = eventReceipt(await runtime.replay(route));
  assert.equal((await runtime.appendInteraction(route, {
    type: "ping", message: followup, expectedLength: observed.length, expectedDigest: observed.digest,
  })).exitCode, 0);
  assert.deepEqual((await collect(adapter.send(route, followup))).map(({ state }) => state), ["queued", "unknown"]);
  assert.equal((await runtime.appendInteraction(route, {
    type: "pong", message: "old answer", expectedLength: observed.length, expectedDigest: observed.digest,
  })).exitCode, 1);
  assert.equal(interactionState(await runtime.replay(route)).lastSignal, "ping");
  releaseTool?.();
  releaseTool = undefined;
  let diagnosis: string | undefined;
  for (let i = 0; i < 3; i++) {
    const reply = (await within(replies.next(), 40_000)).value;
    if (typeof reply === "string" && reply.includes("SILVERMOON_GIT_DIAGNOSIS")) {
      diagnosis = reply;
      break;
    }
  }
  assert.ok(diagnosis);
  assert.match(diagnosis, /SILVERMOON_GIT_DIAGNOSIS/);
  assert.equal(toolCalls, 1);
  assert.equal(git(worktree, "rev-parse", "HEAD"), initialCommit);
  let sawStart = false;
  let sawFinish = false;
  const seen = [];
  for (let i = 0; i < 15 && !sawFinish; i++) {
    const event = await nextOrTimeout(observations, 1500);
    if (!event) break;
    seen.push(event);
    if (event.type === "toolDetails"
      && event.name === tool.name
      && event.state === "started") {
      sawStart = typeof event.input === "string";
    }
    if (event.type === "toolDetails"
      && event.name === tool.name
      && event.state === "succeeded") {
      sawFinish = typeof event.output === "string";
    }
  }
  assert.deepEqual({ sawStart, sawFinish }, { sawStart: true, sawFinish: true }, JSON.stringify(seen));
  const after = eventReceipt(await runtime.replay(route));
  assert.equal((await runtime.appendInteraction(route, {
    type: "pong", message: diagnosis, expectedLength: after.length, expectedDigest: after.digest,
  })).exitCode, 0);
  assert.deepEqual(
    interactionState(await runtime.replay(route)).messages.map(
      ({ message }) => message,
    ),
    [first, followup, diagnosis],
  );
  const pending = "SILVERMOON_PENDING_RECOVERY";
  const beforeFailure = eventReceipt(await runtime.replay(route));
  assert.equal((await runtime.appendInteraction(route, {
    type: "ping", message: pending, expectedLength: beforeFailure.length, expectedDigest: beforeFailure.digest,
  })).exitCode, 0);
  await client.forceStop();
  assert.deepEqual((await collect(adapter.send(route, pending))).map(({ state }) => state), ["unknown"]);
  assert.equal(interactionState(await runtime.replay(route)).lastSignal, "ping");
  await assert.rejects(replies.next(), /delivery cannot be confirmed/);
});

test("one real Copilot adapter keeps two project routes independent", {
  skip: process.env.SILVERMOON_REAL_COPILOT !== "1",
  timeout: 120_000,
}, async (t) => {
  const projects = [await liveProject(), await liveProject()];
  let adapter: CopilotAdapter;
  const replies: AsyncIterator<string>[] = [];
  t.after(async () => {
    for (const stream of replies) await stream.return?.();
    if (adapter) await adapter.close();
    for (const project of projects) await rm(project.base, { recursive: true, force: true });
  });
  const [firstProject, secondProject] = projects;
  assert.ok(firstProject && secondProject);
  const registry = firstProject.registry;
  await registry.register(secondProject.route.projectUrl, secondProject.root);
  const runtime = new ProjectRuntime({ registry });
  adapter = new CopilotAdapter({ registry, onPermissionRequest: () => ({ kind: "reject" }) });
  await Promise.all(projects.map(({ route }) => adapter.start(route)));
  const tokens = ["SILVERMOON_ROUTE_ALPHA", "SILVERMOON_ROUTE_BETA"];
  for (const { route } of projects) replies.push(adapter.events(route)[Symbol.asyncIterator]());
  await Promise.all(projects.map(async ({ route }, index) => {
    const before = eventReceipt(await runtime.replay(route));
    const message = `Reply with exactly ${tokens[index]}. Do not use tools.`;
    assert.equal((await runtime.appendInteraction(route, {
      type: "ping", message, expectedLength: before.length, expectedDigest: before.digest,
    })).exitCode, 0);
    assert.deepEqual((await collect(adapter.send(route, message))).map(({ state }) => state),
      ["queued", "unknown"]);
  }));
  const answers = await Promise.all(replies.map((stream) => within(stream.next(), 45_000)));
  for (const [index, { route }] of projects.entries()) {
    const result = answers[index];
    const token = tokens[index];
    const otherToken = tokens[1 - index];
    assert.ok(result && token && otherToken);
    const answer = result.value;
    assert.ok(typeof answer === "string");
    assert.match(answer, new RegExp(token));
    assert.doesNotMatch(answer, new RegExp(otherToken));
    const before = eventReceipt(await runtime.replay(route));
    assert.equal((await runtime.appendInteraction(route, {
      type: "pong", message: answer, expectedLength: before.length, expectedDigest: before.digest,
    })).exitCode, 0);
    const interaction = interactionState(await runtime.replay(route));
    assert.equal(interaction.messages.length, 2);
    assert.equal(interaction.lastSignal, "pong");
  }
});
