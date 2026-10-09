import assert from "node:assert/strict";
import { mkdir, mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  ProjectRuntime,
  type RuntimeResult,
} from "../../src/business/agent-project-runtime.ts";
import { LocalProjectRegistry } from "../../src/business/agent-project-registry.ts";
import type { IdeaRoute } from "../../src/business/agent-copilot.ts";
import { migrateEvents } from "../../src/business/migrate-v1-to-v2.ts";
import { createRepository, FIRST_ID, git, PRIMARY_REPOSITORY } from "../helpers/repository.ts";

const ROUTE = { projectUrl: "https://github.com/example/project.git", ideaId: "01M3SK3CGZF47A36D2GWN8BFPC" };
const sourceRoot = fileURLToPath(new URL("../..", import.meta.url));

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function eventReceipt(result: RuntimeResult) {
  const value = result.report.observation.receipt;
  assert.ok(isRecord(value));
  assert.ok(typeof value.id === "string");
  assert.ok(typeof value.outcome === "string");
  assert.ok(typeof value.length === "number");
  assert.ok(typeof value.digest === "string");
  return {
    id: value.id,
    outcome: value.outcome,
    length: value.length,
    digest: value.digest,
    events: Array.isArray(value.events)
      ? value.events.map((event: unknown) => event)
      : [],
  };
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
  assert.equal(typeof interaction.lastSignal, "string");
  assert.ok(Array.isArray(interaction.messages));
  return interaction;
}

function nextSteps(result: RuntimeResult): string[] {
  const value = result.report.response.nextSteps;
  assert.ok(Array.isArray(value));
  assert.ok(value.every((step) => typeof step === "string"));
  return value;
}

test("dispatches every project through one host runtime and relays its report", async () => {
  const base = await mkdtemp(join(tmpdir(), "silvermoon-runtime-"));
  const roots = [join(base, "first"), join(base, "second")];
  try {
    const routes = roots.map((_, index) => ({
      ...ROUTE, projectUrl: `https://github.com/example/project-${index}.git`,
    }));
    for (const root of roots) await mkdir(root, { recursive: true });
    const entry = join(base, "runtime", "silvermoon.js");
    await mkdir(join(entry, ".."), { recursive: true });
    await writeFile(entry, `
const args = process.argv.slice(2);
const command = args[0];
const content = args.includes("--input") ? JSON.parse(require("node:fs").readFileSync(args[args.indexOf("--input") + 1], "utf8")) : null;
const operation = command === "event" ? args[1] : undefined;
const idea = args[command === "event" ? 2 : 1];
if (content?.payload?.message === "transport-failure") process.exit(2);
if (content?.payload?.message === "invalid-json") {
  console.log("not a report");
  process.exit(0);
}
console.log(JSON.stringify({
  intention: { command, args: { idea, operation: content?.payload?.message === "wrong-operation" ? "revise" : operation } },
  observation: command === "event"
    ? { state: "event-result", content, receipt: {
      id: idea, outcome: "observed", length: 0, digest: "0".repeat(64)
    } }
    : { state: "idea-selected" },
  actions: [], response: { nextSteps: [process.cwd()] }
}));
if (content?.payload?.message === "fail") process.exitCode = 1;
`);
    class FixtureRegistry extends LocalProjectRegistry {
      constructor() {
        super({ root: join(base, "registry") });
      }

      override async resolve({ projectUrl }: IdeaRoute) {
        const root = roots[routes.findIndex((route) => route.projectUrl === projectUrl)];
        assert.ok(root);
        return root;
      }
    }
    const [firstRoute, secondRoute] = routes;
    const [firstRoot, secondRoot] = roots;
    assert.ok(firstRoute && secondRoute && firstRoot && secondRoot);
    const registry = new FixtureRegistry();
    const runtime = new ProjectRuntime({ entryPath: entry, registry });
    assert.equal(nextSteps(await runtime.next(firstRoute))[0], firstRoot);
    assert.equal(nextSteps(await runtime.next(secondRoute))[0], secondRoot);
    const appended = await runtime.appendInteraction(firstRoute, {
      type: "pong", message: "diagnose Git", expectedLength: 0, expectedDigest: "0".repeat(64),
    });

    assert.deepEqual(appended.report.observation.content, { type: "pong", payload: { message: "diagnose Git" } });
    assert.equal(appended.protocolVersion, 1);
    assert.equal(appended.exitCode, 0);
    const unavailable = await runtime.appendInteraction(firstRoute, {
      type: "pong", message: "fail", expectedLength: 0, expectedDigest: "0".repeat(64),
    });
    assert.equal(nextSteps(unavailable)[0], firstRoot);
    assert.equal(unavailable.exitCode, 1);
    await assert.rejects(runtime.appendInteraction(firstRoute, {
      type: "pong", message: "wrong-operation", expectedLength: 0, expectedDigest: "0".repeat(64),
    }), /does not support report protocol/);
    await assert.rejects(runtime.appendInteraction(firstRoute, {
      type: "pong", message: "transport-failure", expectedLength: 0, expectedDigest: "0".repeat(64),
    }), /Project runtime event failed/);
    await assert.rejects(runtime.appendInteraction(firstRoute, {
      type: "pong", message: "invalid-json", expectedLength: 0, expectedDigest: "0".repeat(64),
    }), /invalid JSON/);
    await assert.rejects(
      Reflect.apply(runtime.appendInteraction, runtime, [firstRoute, {
        type: "acceptIdeal",
        message: "yes",
        expectedLength: 0,
        expectedDigest: "0".repeat(64),
      }]),
      TypeError,
    );
    await rename(entry, `${entry}.missing`);
    await assert.rejects(
      runtime.next(secondRoute),
      /repair the device or host installation/,
    );
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("runs this checkout's real event reader in a child process", async () => {
  class SourceRegistry extends LocalProjectRegistry {
    override async projectRoot() {
      return sourceRoot;
    }

    override async resolve() {
      return sourceRoot;
    }
  }
  const runtime = new ProjectRuntime({ registry: new SourceRegistry() });
  const result = await runtime.replay({
    projectUrl: "https://github.com/shazhou-ww/silvermoon.git",
    ideaId: ROUTE.ideaId,
  });
  assert.equal(result.report.intention.command, "event");
  assert.equal(eventReceipt(result).id, ROUTE.ideaId);
});

test("real project CLI preserves exact interaction state across child processes", async (t) => {
  const { base, root } = await createRepository();
  t.after(() => rm(base, { recursive: true, force: true }));
  const migration = await migrateEvents({ root });
  assert.ok("digest" in migration && typeof migration.digest === "string");
  await migrateEvents({ root, apply: true, expectedDigest: migration.digest });
  git(root, "add", ".");
  git(root, "commit", "-m", "Migrate fixture");
  git(root, "push", "origin", "HEAD:main");
  const registry = new LocalProjectRegistry({ root: join(base, "registry") });
  await registry.register(PRIMARY_REPOSITORY, root);
  const route = { projectUrl: PRIMARY_REPOSITORY, ideaId: FIRST_ID };
  const runtime = new ProjectRuntime({ registry });
  const selected = await runtime.next(route);
  assert.equal(selected.exitCode, 0);
  assert.equal(selected.report.observation.state, "idea-selected");
  const initial = await runtime.replay(route);
  assert.equal(initial.exitCode, 0);
  const before = eventReceipt(initial);
  const request: Parameters<ProjectRuntime["appendInteraction"]>[1] = {
    type: "ping", message: "diagnose Git", expectedLength: before.length, expectedDigest: before.digest,
  };
  const written = await runtime.appendInteraction(route, request);
  assert.equal(eventReceipt(written).outcome, "candidate-written");
  assert.equal(eventReceipt(await runtime.appendInteraction(route, request)).outcome, "already-present");
  const after = await runtime.replay(route);
  assert.equal(interactionState(after).lastSignal, "ping");
  const delta = await runtime.readSince(route, before);
  assert.equal(delta.exitCode, 0);
  const deltaReceipt = eventReceipt(delta);
  assert.equal(deltaReceipt.outcome, "delta-observed");
  assert.deepEqual(deltaReceipt.events, [{
    sequence: 2, type: "ping", payload: { message: "diagnose Git" },
  }]);
  const unchanged = await runtime.readSince(route, deltaReceipt);
  assert.deepEqual(eventReceipt(unchanged).events, []);
  await assert.rejects(runtime.readSince(route, { length: -1, digest: before.digest }), TypeError);
  const stale = await runtime.appendInteraction(route, { ...request, type: "pong", message: "old answer" });
  assert.equal(stale.exitCode, 1);
  assert.equal(
    eventReceipt(await runtime.replay(route)).length,
    eventReceipt(after).length,
  );
});

test("the project CLI requests v1 migration without inventing event support", async (t) => {
  const { base, root } = await createRepository();
  t.after(() => rm(base, { recursive: true, force: true }));
  const registry = new LocalProjectRegistry({ root: join(base, "registry") });
  await registry.register(PRIMARY_REPOSITORY, root);
  const route = { projectUrl: PRIMARY_REPOSITORY, ideaId: FIRST_ID };
  const runtime = new ProjectRuntime({ registry });
  const selected = await runtime.next(route);
  assert.equal(selected.exitCode, 0);
  assert.equal(selected.report.observation.state, "project-setup-required");
  const problems: unknown = selected.report.observation.problems;
  assert.ok(Array.isArray(problems));
  assert.ok(problems.every((problem) =>
    problem !== null
    && typeof problem === "object"
    && "type" in problem
    && problem.type === "schema-migration-required"
  ));
  const unsupported = await runtime.replay(route);
  assert.equal(unsupported.exitCode, 1);
  assert.equal(unsupported.report.response.kind, "blocked");
  assert.notEqual(unsupported.report.observation.state, "event-result");
});
