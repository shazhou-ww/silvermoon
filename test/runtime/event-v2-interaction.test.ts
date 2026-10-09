import assert from "node:assert/strict";
import { readFile, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

import { eventCommand } from "../../src/business/event-command.ts";
import { migrateEvents } from "../../src/business/migrate-v1-to-v2.ts";
import { createIdea } from "../../src/business/create-idea.ts";
import { checkRepository } from "../../src/index.ts";
import { parseIdeaEvents } from "../../src/foundation/event-codec/index.ts";
import { ideaPaths } from "../../src/foundation/coordinates/index.ts";
import type { EventReceipt } from "../../src/foundation/report/types.ts";
import type { RepositoryFixtureOptions } from "../helpers/repository.ts";
import { createRepository, FIRST_ID, SECOND_ID, git } from "../helpers/repository.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requiredRecord(value: unknown, name: string): Record<string, unknown> {
  if (!isRecord(value)) assert.fail(`${name} must be an object`);
  return value;
}

function requiredNumber(value: unknown, name: string): number {
  if (typeof value !== "number") assert.fail(`${name} must be a number`);
  return value;
}

function requiredString(value: unknown, name: string): string {
  if (typeof value !== "string") assert.fail(`${name} must be a string`);
  return value;
}

function replayReceipt(receipt: EventReceipt) {
  const baseline = requiredRecord(receipt.baseline, "baseline");
  const reduction = requiredRecord(receipt.reduction, "reduction");
  const state = requiredRecord(reduction.state, "reduction.state");
  const interaction = requiredRecord(state.interaction, "reduction.state.interaction");
  const control = requiredRecord(state.control, "reduction.state.control");
  const messages = interaction.messages;
  assert.ok(Array.isArray(messages), "reduction.state.interaction.messages must be an array");
  return {
    ...receipt,
    baseline,
    digest: requiredString(receipt.digest, "digest"),
    length: requiredNumber(receipt.length, "length"),
    reduction: {
      ...reduction,
      state: {
        ...state,
        interaction: {
          ...interaction,
          messages,
        },
        control: {
          ...control,
          owner: requiredString(control.owner, "reduction.state.control.owner"),
        },
      },
    },
  };
}

async function fixture(t: test.TestContext, options?: RepositoryFixtureOptions) {
  const repository = await createRepository(options);
  t.after(() => rm(repository.base, { recursive: true, force: true }));
  const v2 = await migrateEvents({ root: repository.root });
  assert.ok("digest" in v2);
  await migrateEvents({ root: repository.root, apply: true, expectedDigest: v2.digest });
  git(repository.root, "add", ".");
  git(repository.root, "commit", "-m", "Migrate to v2");
  git(repository.root, "push", "origin", "HEAD:main");
  return repository;
}

async function replay(root: string) {
  const report = await eventCommand({ root, operation: "replay", idea: FIRST_ID, input: null });
  assert.equal(report.observation.state, "event-result", JSON.stringify(report.observation));
  if (report.observation.state !== "event-result") {
    throw new Error("Expected an event-result observation");
  }
  return replayReceipt(report.observation.receipt);
}

function eventReceipt(report: Awaited<ReturnType<typeof eventCommand>>) {
  assert.equal(report.observation.state, "event-result", JSON.stringify(report.observation));
  if (report.observation.state !== "event-result") {
    throw new Error("Expected an event-result observation");
  }
  return report.observation.receipt;
}

test("local ping/pong append works offline, preserves blockers and rejects stale responses", async (t) => {
  const { root, remote } = await fixture(t);
  assert.ok(remote);
  const offline = `${remote}.offline`;
  await rename(remote, offline);
  git(root, "update-ref", "-d", "refs/remotes/origin/main");
  const observed = await replay(root);
  assert.match(requiredString(observed.baseline.unavailable, "baseline.unavailable"), /tracking ref unavailable/);
  assert.deepEqual(observed.reduction.state.interaction, { messages: [] });
  assert.deepEqual(observed.reduction.state.control, {
    owner: "downstream",
    lastTransfer: null,
  });
  const pong = { type: "pong", payload: { message: "blocked" } };
  const request = {
    root, operation: "append", idea: FIRST_ID, input: pong,
    expectedDigest: observed.digest,
  };
  const first = await eventCommand(request);
  assert.equal(eventReceipt(first).outcome, "candidate-written", JSON.stringify(first.observation));
  assert.equal(eventReceipt(await eventCommand(request)).outcome, "already-present");
  const after = await replay(root);
  const repeated = await eventCommand({
    ...request, input: { type: "pong", payload: { message: "still blocked" } },
    expectedDigest: after.digest,
  });
  assert.equal(eventReceipt(repeated).outcome, "candidate-written");
  const following = await replay(root);
  const ping = await eventCommand({
    ...request, input: { type: "ping", payload: { message: "new objective" } },
    expectedDigest: following.digest,
  });
  assert.equal(eventReceipt(ping).outcome, "candidate-written", JSON.stringify(ping.observation));
  const stale = await eventCommand({
    ...request, input: { type: "pong", payload: { message: "old blocker" } },
    expectedDigest: following.digest,
  });
  assert.equal(stale.observation.state, "check-unavailable");
  const current = await replay(root);
  assert.deepEqual(current.reduction.state.interaction.messages.map(({ message }: { message: string }) => message),
    ["blocked", "still blocked", "new objective"]);
  assert.deepEqual(current.reduction.state.control, {
    owner: "downstream",
    lastTransfer: { sequence: 4, type: "ping" },
  });
  const next = await eventCommand({
    ...request, input: pong, expectedDigest: current.digest,
  });
  assert.equal(eventReceipt(next).outcome, "candidate-written", JSON.stringify(next.observation));
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
    expectedDigest: observed.digest,
  });

  assert.equal(metadata.observation.state, "check-unavailable");
  const written = await eventCommand({
    root, operation: "append", idea: FIRST_ID,
    input: { type: "setLanguage", payload: { language: "zh-CN" } },
    expectedDigest: observed.digest,
    expectedPrimary: requiredString(observed.baseline.commit, "baseline.commit"),
  });
  assert.equal(eventReceipt(written).outcome, "candidate-written", JSON.stringify(written.observation));
  git(root, "add", ".");
  git(root, "commit", "-m", "Metadata");
  git(root, "push", "origin", "HEAD:main");
  const created = await createIdea({ root, generateId: () => SECOND_ID, language: "zh-CN" });
  assert.equal(created.observation.state, "idea-created", JSON.stringify(created.observation));
  if (created.observation.state !== "idea-created") {
    throw new Error("Expected an idea-created observation");
  }
  assert.deepEqual(parseIdeaEvents(await readFile(join(root, ideaPaths(SECOND_ID).eventsPath)))
    .map(({ type }) => type), ["setLanguage"]);
});

test("v2 replay and interaction accept a SHA-256 repository's revisions", async (t) => {
  const { root } = await fixture(t, { objectFormat: "sha256" });
  const observed = await replay(root);
  const written = await eventCommand({
    root, operation: "append", idea: FIRST_ID,
    input: { type: "ping", payload: { message: "new objective" } },
    expectedDigest: observed.digest,
  });
  assert.equal(eventReceipt(written).outcome, "candidate-written", JSON.stringify(written.observation));
  assert.equal((await replay(root)).reduction.state.control.owner, "downstream");
});
