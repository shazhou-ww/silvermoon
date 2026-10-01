import assert from "node:assert/strict";
import { mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { CopilotAdapter, LocalProjectRegistry } from "../../src/agents/copilot.js";
import { ProjectRuntime } from "../../src/agents/project-runtime.js";
import { migrateEvents } from "../../src/migrate-events.js";
import { createRepository, FIRST_ID, git, PRIMARY_REPOSITORY } from "../helpers/repository.js";

const sourceRoot = fileURLToPath(new URL("../..", import.meta.url));

test("real Copilot replies through the project-version interaction boundary", {
  skip: process.env.SILVERMOON_REAL_COPILOT !== "1",
  timeout: 120_000,
}, async (t) => {
  const { base, root } = await createRepository();
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
  const migration = await migrateEvents({ root });
  await migrateEvents({ root, apply: true, expectedDigest: migration.digest });
  git(root, "add", ".");
  git(root, "commit", "-m", "Migrate fixture");
  git(root, "push", "origin", "HEAD:main");
  await writeFile(join(root, "package.json"), JSON.stringify({ name: "consumer" }));
  await mkdir(join(root, "node_modules"), { recursive: true });
  await symlink(sourceRoot, join(root, "node_modules", "silvermoon"), "dir");

  const registry = new LocalProjectRegistry({ root: join(base, "registry") });
  await registry.register(PRIMARY_REPOSITORY, root);
  const route = { projectUrl: PRIMARY_REPOSITORY, ideaId: FIRST_ID };
  const runtime = new ProjectRuntime({ registry });
  adapter = new CopilotAdapter({
    registry,
    onPermissionRequest: () => ({ kind: "deny" }),
  });
  await adapter.start(route);
  replies = adapter.events(route)[Symbol.asyncIterator]();

  const messages = [];
  const round = async (token) => {
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
    assert.match(reply, new RegExp(token));
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
  await round("SILVERMOON_TEST_RESUMED");
  const final = (await runtime.replay(route)).report.observation.receipt.reduction.state.interaction;
  assert.deepEqual(final.messages.map(({ message }) => message), messages);
  assert.equal(final.lastSignal, "pong");
});
