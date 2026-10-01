import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { CopilotClient } from "@github/copilot-sdk";

import { CopilotAdapter, LocalProjectRegistry } from "../../src/agents/copilot.js";
import { ProjectRuntime } from "../../src/agents/project-runtime.js";
import { migrateEvents } from "../../src/migrate-events.js";
import { createRepository, FIRST_ID, git, PRIMARY_REPOSITORY } from "../helpers/repository.js";

const sourceRoot = fileURLToPath(new URL("../..", import.meta.url));

async function within(promise, milliseconds) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Copilot did not respond within ${milliseconds}ms`)), milliseconds);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function nextOrTimeout(iterator, milliseconds) {
  let timer;
  try {
    return await Promise.race([
      iterator.next().then(({ value }) => value),
      new Promise((resolve) => { timer = setTimeout(() => resolve(null), milliseconds); }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function liveProject() {
  const { base, root, repository } = await createRepository();
  const migration = await migrateEvents({ root });
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
  await writeFile(join(root, "package.json"), JSON.stringify({ name: "consumer" }));
  await mkdir(join(root, "node_modules"), { recursive: true });
  await symlink(sourceRoot, join(root, "node_modules", "silvermoon"), "dir");
  const registry = new LocalProjectRegistry({ root: join(base, "registry") });
  await registry.register(projectUrl, root);
  const route = { projectUrl, ideaId: FIRST_ID };
  return { base, root, registry, route, runtime: new ProjectRuntime({ registry }) };
}

test("real Copilot replies through the project-version interaction boundary", {
  skip: process.env.SILVERMOON_REAL_COPILOT !== "1",
  timeout: 120_000,
}, async (t) => {
  const { base, registry, route, runtime } = await liveProject();
  let adapter;
  let replies;
  t.after(async () => {
    try {
      if (replies) await replies.return();
      if (adapter) await adapter.close();
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });
  adapter = new CopilotAdapter({
    registry,
    onPermissionRequest: () => ({ kind: "deny" }),
  });
  await adapter.start(route);
  replies = adapter.events(route)[Symbol.asyncIterator]();

  const messages = [];
  const round = async (token, { expectToken = true } = {}) => {
    const prompt = `Reply with exactly the text ${token}. Do not use tools.`;
    const original = (await runtime.replay(route)).report.observation.receipt;
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
    const receipt = (await runtime.replay(route)).report.observation.receipt;
    const pong = await runtime.appendInteraction(route, {
      type: "pong", message: reply, expectedLength: receipt.length, expectedDigest: receipt.digest,
    });
    assert.equal(pong.exitCode, 0);
    messages.push(prompt, reply);
  };
  await round("SILVERMOON_TEST_READY");
  await round("SILVERMOON_TEST_AGAIN");
  await replies.return();
  await adapter.close();
  adapter = new CopilotAdapter({ registry, onPermissionRequest: () => ({ kind: "deny" }) });
  await adapter.start(route);
  replies = adapter.events(route)[Symbol.asyncIterator]();
  await round("SILVERMOON_TEST_RESUMED", { expectToken: false });
  const final = (await runtime.replay(route)).report.observation.receipt.reduction.state.interaction;
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
  let adapter;
  let client;
  let observations;
  let replies;
  let releaseTool;
  t.after(async () => {
    if (releaseTool) releaseTool();
    if (observations) await observations.return();
    if (replies) await replies.return();
    if (adapter) await adapter.close();
    if (client) await client.stop();
    await rm(base, { recursive: true, force: true });
  });

  let toolStarted;
  const started = new Promise((resolve) => { toolStarted = resolve; });
  let toolCalls = 0;
  const tool = {
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
      await new Promise((resolve) => { releaseTool = resolve; });
      const attempt = spawnSync("git", [
        "-C", worktree, "-c", `core.hooksPath=${hooks}`,
        "commit", "--allow-empty", "-m", "Blocked fixture commit",
      ], { encoding: "utf8" });
      assert.equal(attempt.status, 1, attempt.stderr || attempt.error?.message);
      assert.match(attempt.stderr, /Fixture commit blocked/);
      return "Commit blocked by fixture pre-commit hook; no commit was created.";
    },
  };
  client = new CopilotClient();
  const createSession = client.createSession.bind(client);
  let configured = false;
  client.createSession = (config) => {
    configured = true;
    return createSession({ ...config, tools: [tool], availableTools: [tool.name] });
  };
  adapter = new CopilotAdapter({ client, registry, onPermissionRequest: () => ({ kind: "deny" }) });
  await adapter.start(route);
  assert.equal(configured, true);
  replies = adapter.events(route)[Symbol.asyncIterator]();
  observations = adapter.observe(route)[Symbol.asyncIterator]();
  await observations.next();
  const first = "Call silvermoon_git_probe once, wait for its result, then explain the blocked Git commit.";
  const before = (await runtime.replay(route)).report.observation.receipt;
  assert.equal((await runtime.appendInteraction(route, {
    type: "ping", message: first, expectedLength: before.length, expectedDigest: before.digest,
  })).exitCode, 0);
  assert.deepEqual((await Array.fromAsync(adapter.send(route, first))).map(({ state }) => state), ["queued", "unknown"]);
  await within(started, 30_000);
  const followup = "Pause commit attempts, diagnose the failed Git commit and include SILVERMOON_GIT_DIAGNOSIS. Do not call tools.";
  const observed = (await runtime.replay(route)).report.observation.receipt;
  assert.equal((await runtime.appendInteraction(route, {
    type: "ping", message: followup, expectedLength: observed.length, expectedDigest: observed.digest,
  })).exitCode, 0);
  assert.deepEqual((await Array.fromAsync(adapter.send(route, followup))).map(({ state }) => state), ["queued", "unknown"]);
  assert.equal((await runtime.appendInteraction(route, {
    type: "pong", message: "old answer", expectedLength: observed.length, expectedDigest: observed.digest,
  })).exitCode, 1);
  assert.equal((await runtime.replay(route)).report.observation.receipt.reduction.state.interaction.lastSignal, "ping");
  releaseTool();
  releaseTool = undefined;
  let diagnosis;
  for (let i = 0; i < 3; i++) {
    const reply = (await within(replies.next(), 40_000)).value;
    if (reply.includes("SILVERMOON_GIT_DIAGNOSIS")) {
      diagnosis = reply;
      break;
    }
  }
  assert.match(diagnosis, /SILVERMOON_GIT_DIAGNOSIS/);
  assert.equal(toolCalls, 1);
  assert.equal(git(worktree, "rev-parse", "HEAD"), initialCommit);
  let sawStart = false;
  let sawFinish = false;
  const seen = [];
  for (let i = 0; i < 15 && !sawFinish; i++) {
    const event = await nextOrTimeout(observations, 1500);
    if (!event) break;
    seen.push({ type: event.type, state: event.state, name: event.name });
    if (event.name === tool.name && event.state === "started") {
      sawStart = event.type === "toolDetails" && typeof event.input === "string";
    }
    if (event.name === tool.name && event.state === "succeeded") {
      sawFinish = event.type === "toolDetails" && typeof event.output === "string";
    }
  }
  assert.deepEqual({ sawStart, sawFinish }, { sawStart: true, sawFinish: true }, JSON.stringify(seen));
  const after = (await runtime.replay(route)).report.observation.receipt;
  assert.equal((await runtime.appendInteraction(route, {
    type: "pong", message: diagnosis, expectedLength: after.length, expectedDigest: after.digest,
  })).exitCode, 0);
  assert.deepEqual((await runtime.replay(route)).report.observation.receipt.reduction.state.interaction.messages
    .map(({ message }) => message), [first, followup, diagnosis]);
  const pending = "SILVERMOON_PENDING_RECOVERY";
  const beforeFailure = (await runtime.replay(route)).report.observation.receipt;
  assert.equal((await runtime.appendInteraction(route, {
    type: "ping", message: pending, expectedLength: beforeFailure.length, expectedDigest: beforeFailure.digest,
  })).exitCode, 0);
  await client.forceStop();
  assert.deepEqual((await Array.fromAsync(adapter.send(route, pending))).map(({ state }) => state), ["unknown"]);
  assert.equal((await runtime.replay(route)).report.observation.receipt.reduction.state.interaction.lastSignal, "ping");
  await assert.rejects(replies.next(), /delivery cannot be confirmed/);
});

test("one real Copilot adapter keeps two project routes independent", {
  skip: process.env.SILVERMOON_REAL_COPILOT !== "1",
  timeout: 120_000,
}, async (t) => {
  const projects = [await liveProject(), await liveProject()];
  let adapter;
  const replies = [];
  t.after(async () => {
    for (const stream of replies) await stream.return();
    if (adapter) await adapter.close();
    for (const project of projects) await rm(project.base, { recursive: true, force: true });
  });
  const registry = projects[0].registry;
  await registry.register(projects[1].route.projectUrl, projects[1].root);
  const runtime = new ProjectRuntime({ registry });
  adapter = new CopilotAdapter({ registry, onPermissionRequest: () => ({ kind: "deny" }) });
  await Promise.all(projects.map(({ route }) => adapter.start(route)));
  const tokens = ["SILVERMOON_ROUTE_ALPHA", "SILVERMOON_ROUTE_BETA"];
  for (const { route } of projects) replies.push(adapter.events(route)[Symbol.asyncIterator]());
  await Promise.all(projects.map(async ({ route }, index) => {
    const before = (await runtime.replay(route)).report.observation.receipt;
    const message = `Reply with exactly ${tokens[index]}. Do not use tools.`;
    assert.equal((await runtime.appendInteraction(route, {
      type: "ping", message, expectedLength: before.length, expectedDigest: before.digest,
    })).exitCode, 0);
    assert.deepEqual((await Array.fromAsync(adapter.send(route, message))).map(({ state }) => state),
      ["queued", "unknown"]);
  }));
  const answers = await Promise.all(replies.map((stream) => within(stream.next(), 45_000)));
  for (const [index, { route }] of projects.entries()) {
    const answer = answers[index].value;
    assert.match(answer, new RegExp(tokens[index]));
    assert.doesNotMatch(answer, new RegExp(tokens[1 - index]));
    const before = (await runtime.replay(route)).report.observation.receipt;
    assert.equal((await runtime.appendInteraction(route, {
      type: "pong", message: answer, expectedLength: before.length, expectedDigest: before.digest,
    })).exitCode, 0);
    const interaction = (await runtime.replay(route)).report.observation.receipt.reduction.state.interaction;
    assert.equal(interaction.messages.length, 2);
    assert.equal(interaction.lastSignal, "pong");
  }
});
