import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { ProjectRuntime } from "../../src/agents/project-runtime.js";

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
console.log(JSON.stringify({
  intention: { command }, observation: { state: "${index}", content },
  actions: {}, response: { nextSteps: ["${index}"] }
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
      type: "acceptIdeal", message: "yes", expectedLength: 0, expectedDigest: "0".repeat(64),
    }), TypeError);
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
