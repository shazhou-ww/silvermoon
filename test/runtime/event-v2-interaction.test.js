import assert from "node:assert/strict";
import { readFile, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

import { eventCommand } from "../../src/event-command.js";
import { migrateEvents } from "../../src/migrate-events.js";
import { createIdea } from "../../src/create-idea.js";
import { checkRepository } from "../../src/index.js";
import { parseIdeaEvents } from "../../src/idea-events.js";
import { ideaPaths } from "../../src/layout.js";
import { createRepository, FIRST_ID, SECOND_ID, git } from "../helpers/repository.js";

async function fixture(t, options) {
  const repository = await createRepository(options);
  t.after(() => rm(repository.base, { recursive: true, force: true }));
  const v2 = await migrateEvents({ root: repository.root });
  await migrateEvents({ root: repository.root, apply: true, expectedDigest: v2.digest });
  git(repository.root, "add", ".");
  git(repository.root, "commit", "-m", "Migrate to v2");
  git(repository.root, "push", "origin", "HEAD:main");
  return repository;
}

async function replay(root) {
  const report = await eventCommand({ root, operation: "replay", idea: FIRST_ID });
  assert.equal(report.observation.state, "event-result", JSON.stringify(report.observation));
  return report.observation.receipt;
}

test("local ping/pong append works offline, preserves blockers and rejects stale responses", async (t) => {
  const { root, remote } = await fixture(t);
  const offline = `${remote}.offline`;
  await rename(remote, offline);
  git(root, "update-ref", "-d", "refs/remotes/origin/main");
  const observed = await replay(root);
  assert.match(observed.baseline.unavailable, /tracking ref unavailable/);
  assert.deepEqual(observed.reduction.state.interaction, { messages: [], lastSignal: null });
  const pong = { type: "pong", payload: { message: "blocked" } };
  const request = {
    root, operation: "append", idea: FIRST_ID, input: pong,
    expectedLength: observed.length, expectedDigest: observed.digest,
  };
  const first = await eventCommand(request);
  assert.equal(first.observation.receipt?.outcome, "candidate-written", JSON.stringify(first.observation));
  assert.equal((await eventCommand(request)).observation.receipt.outcome, "already-present");
  const after = await replay(root);
  const repeated = await eventCommand({
    ...request, input: { type: "pong", payload: { message: "still blocked" } },
    expectedLength: after.length, expectedDigest: after.digest,
  });
  assert.equal(repeated.observation.receipt?.outcome, "candidate-written");
  const following = await replay(root);
  const ping = await eventCommand({
    ...request, input: { type: "ping", payload: { message: "new objective" } },
    expectedLength: following.length, expectedDigest: following.digest,
  });
  assert.equal(ping.observation.receipt?.outcome, "candidate-written", JSON.stringify(ping.observation));
  const stale = await eventCommand({
    ...request, input: { type: "pong", payload: { message: "old blocker" } },
    expectedLength: following.length, expectedDigest: following.digest,
  });
  assert.equal(stale.observation.state, "check-unavailable");
  const current = await replay(root);
  assert.deepEqual(current.reduction.state.interaction.messages.map(({ message }) => message),
    ["blocked", "still blocked", "new objective"]);
  assert.equal(current.reduction.state.interaction.lastSignal, "ping");
  const next = await eventCommand({
    ...request, input: pong, expectedLength: current.length, expectedDigest: current.digest,
  });
  assert.equal(next.observation.receipt?.outcome, "candidate-written", JSON.stringify(next.observation));
  assert.equal((await checkRepository({ root, worktree: true })).observation.state, "check-unavailable");
  assert.deepEqual(parseIdeaEvents(await readFile(join(root, ideaPaths(FIRST_ID).eventsPath)))
    .map(({ type }) => type), ["setAlias", "pong", "pong", "ping", "pong"]);
});

test("v2 business events retain primary gate, and new ideas use final v2 records", async (t) => {
  const { root } = await fixture(t);
  const observed = await replay(root);
  const metadata = await eventCommand({
    root, operation: "append", idea: FIRST_ID,
    input: { type: "setLanguage", payload: { language: "zh-CN" } },
    expectedLength: observed.length, expectedDigest: observed.digest,
  });

  assert.equal(metadata.observation.state, "check-unavailable");
  const written = await eventCommand({
    root, operation: "append", idea: FIRST_ID,
    input: { type: "setLanguage", payload: { language: "zh-CN" } },
    expectedLength: observed.length, expectedDigest: observed.digest,
    expectedPrimary: observed.baseline.commit,
  });
  assert.equal(written.observation.receipt?.outcome, "candidate-written", JSON.stringify(written.observation));
  git(root, "add", ".");
  git(root, "commit", "-m", "Metadata");
  git(root, "push", "origin", "HEAD:main");
  const created = await createIdea({ root, generateId: () => SECOND_ID, language: "zh-CN" });
  assert.equal(created.observation.state, "idea-created", JSON.stringify(created.observation));
  assert.deepEqual(parseIdeaEvents(await readFile(join(root, ideaPaths(SECOND_ID).eventsPath)))
    .map(({ type }) => type), ["setLanguage"]);
});

test("v2 replay and interaction accept a SHA-256 repository's revisions", async (t) => {
  const { root } = await fixture(t, { objectFormat: "sha256" });
  const observed = await replay(root);
  const written = await eventCommand({
    root, operation: "append", idea: FIRST_ID,
    input: { type: "ping", payload: { message: "new objective" } },
    expectedLength: observed.length, expectedDigest: observed.digest,
  });
  assert.equal(written.observation.receipt?.outcome, "candidate-written", JSON.stringify(written.observation));
  assert.equal((await replay(root)).reduction.state.interaction.lastSignal, "ping");
});
