import assert from "node:assert/strict";
import { mkdir, mkdtemp, rename, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { ProjectRuntime } from "../../src/agents/project-runtime.js";
import { LocalProjectRegistry } from "../../src/agents/project-registry.js";
import { migrateEvents } from "../../src/migrate-events.js";
import { createRepository, FIRST_ID, git, PRIMARY_REPOSITORY } from "../helpers/repository.js";

const ROUTE = { projectUrl: "https://github.com/example/project.git", ideaId: "01M3SK3CGZF47A36D2GWN8BFPC" };
const sourceRoot = fileURLToPath(new URL("../..", import.meta.url));

test("dispatches to each project's own isolated CLI and relays its report", async () => {
  const base = await mkdtemp(join(tmpdir(), "silvermoon-runtime-"));
  const roots = [join(base, "source"), join(base, "installed")];
  try {
    const routes = roots.map((_, index) => ({
      ...ROUTE, projectUrl: `https://github.com/example/project-${index}.git`,
    }));
    for (const [index, root] of roots.entries()) {
      const entry = index === 0 ? join(root, "bin", "silvermoon.js")
        : join(root, "node_modules", "silvermoon", "bin", "silvermoon.js");
      await mkdir(join(entry, ".."), { recursive: true });
      await writeFile(join(root, "package.json"), JSON.stringify({ name: index === 0 ? "silvermoon" : "consumer" }));
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
  actions: [], response: { nextSteps: ["${index}"] }
}));
if (content?.payload?.message === "fail") process.exitCode = 1;
`);
    }
    const registry = {
      projectRoot: async ({ projectUrl }) => roots[routes.findIndex((route) => route.projectUrl === projectUrl)],
      resolve: async ({ projectUrl }) => roots[routes.findIndex((route) => route.projectUrl === projectUrl)],
    };
    const runtime = new ProjectRuntime({ registry });
    assert.equal((await runtime.next(routes[0])).report.response.nextSteps[0], "0");
    assert.equal((await runtime.next(routes[1])).report.response.nextSteps[0], "1");
    const appended = await runtime.appendInteraction(routes[0], {
      type: "pong", message: "diagnose Git", expectedLength: 0, expectedDigest: "0".repeat(64),
    });

    assert.deepEqual(appended.report.observation.content, { type: "pong", payload: { message: "diagnose Git" } });
    assert.equal(appended.protocolVersion, 1);
    assert.equal(appended.exitCode, 0);
    const unavailable = await runtime.appendInteraction(routes[0], {
      type: "pong", message: "fail", expectedLength: 0, expectedDigest: "0".repeat(64),
    });
    assert.equal(unavailable.report.response.nextSteps[0], "0");
    assert.equal(unavailable.exitCode, 1);
    await assert.rejects(runtime.appendInteraction(routes[0], {
      type: "pong", message: "wrong-operation", expectedLength: 0, expectedDigest: "0".repeat(64),
    }), /does not support report protocol/);
    await assert.rejects(runtime.appendInteraction(routes[0], {
      type: "pong", message: "transport-failure", expectedLength: 0, expectedDigest: "0".repeat(64),
    }), /Project runtime event failed/);
    await assert.rejects(runtime.appendInteraction(routes[0], {
      type: "pong", message: "invalid-json", expectedLength: 0, expectedDigest: "0".repeat(64),
    }), /invalid JSON/);
    await assert.rejects(runtime.appendInteraction(routes[0], {
      type: "acceptIdeal", message: "yes", expectedLength: 0, expectedDigest: "0".repeat(64),
    }), TypeError);
    const entry = join(roots[1], "node_modules", "silvermoon", "bin", "silvermoon.js");
    await rename(entry, `${entry}.missing`);
    await assert.rejects(runtime.next(routes[1]), /runtime is missing/);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("runs this checkout's real event reader in a child process", async () => {
  const runtime = new ProjectRuntime({
    registry: { projectRoot: async () => sourceRoot, resolve: async () => sourceRoot },
  });
  const result = await runtime.replay({
    projectUrl: "https://github.com/shazhou-ww/silvermoon.git",
    ideaId: ROUTE.ideaId,
  });
  assert.equal(result.report.intention.command, "event");
  assert.equal(result.report.observation.receipt.id, ROUTE.ideaId);
});

test("real project CLI preserves exact interaction state across child processes", async (t) => {
  const { base, root } = await createRepository();
  t.after(() => rm(base, { recursive: true, force: true }));
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
  const selected = await runtime.next(route);
  assert.equal(selected.exitCode, 0);
  assert.equal(selected.report.observation.state, "idea-selected");
  const initial = await runtime.replay(route);
  assert.equal(initial.exitCode, 0);
  const before = initial.report.observation.receipt;
  const request = {
    type: "ping", message: "diagnose Git", expectedLength: before.length, expectedDigest: before.digest,
  };
  const written = await runtime.appendInteraction(route, request);
  assert.equal(written.report.observation.receipt.outcome, "candidate-written");
  assert.equal((await runtime.appendInteraction(route, request)).report.observation.receipt.outcome, "already-present");
  const after = await runtime.replay(route);
  assert.equal(after.report.observation.receipt.reduction.state.interaction.lastSignal, "ping");
  const stale = await runtime.appendInteraction(route, { ...request, type: "pong", message: "old answer" });
  assert.equal(stale.exitCode, 1);
  assert.equal((await runtime.replay(route)).report.observation.receipt.length, after.report.observation.receipt.length);
});

test("the project CLI interprets legacy v1 schema without inventing event support", async (t) => {
  const { base, root } = await createRepository();
  t.after(() => rm(base, { recursive: true, force: true }));
  await writeFile(join(root, "package.json"), JSON.stringify({ name: "consumer" }));
  await mkdir(join(root, "node_modules"), { recursive: true });
  await symlink(sourceRoot, join(root, "node_modules", "silvermoon"), "dir");
  const registry = new LocalProjectRegistry({ root: join(base, "registry") });
  await registry.register(PRIMARY_REPOSITORY, root);
  const route = { projectUrl: PRIMARY_REPOSITORY, ideaId: FIRST_ID };
  const runtime = new ProjectRuntime({ registry });
  const selected = await runtime.next(route);
  assert.equal(selected.exitCode, 0);
  assert.equal(selected.report.observation.state, "idea-selected");
  const unsupported = await runtime.replay(route);
  assert.equal(unsupported.exitCode, 1);
  assert.equal(unsupported.report.response.kind, "blocked");
  assert.notEqual(unsupported.report.observation.state, "event-result");
});
