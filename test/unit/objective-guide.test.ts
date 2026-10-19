import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createMemoryCheckProbe,
  describeLevels,
  loadPilotSpec,
  observe,
  readPage,
  searchPages,
  startEffect,
} from "../../src/objective-guide/index.ts";
import type {
  CheckProbe,
  PageResource,
  PilotManifest,
  ResourceResolver,
} from "../../src/objective-guide/index.ts";

const manifestUri =
  "git+https://objectives.test/team/repository.git#objectives/project/manifest.yaml";
const version = "a".repeat(40);

function markdown(title: string, description: string, body = "") {
  return `---\ntitle: ${JSON.stringify(title)}\ndescription: ${JSON.stringify(description)}\n---\n${body}\n`;
}

function fixture() {
  const manifest: PilotManifest = {
    schemaVersion: 1,
    domainSchema: {
      type: "object",
      required: ["root"],
      properties: { root: { type: "string" } },
      additionalProperties: false,
    },
    levels: [{
      id: "unready",
      advancement: { checks: [{ id: "ready", problems: ["not-ready"] }] },
    }],
    defaultLanguage: "en-US",
    languages: ["en-US"],
  };
  const pages: Array<[string, string, string, string?]> = [
    ["system/overview", "Project", "Project objective"],
    ["system/404", "Missing", "No such page"],
    ["levels/unready", "Unready", "Project is not ready"],
    ["levels/terminal", "Ready", "Project is ready"],
    ["checks/ready", "Readiness", "Checks project readiness"],
    ["problems/not-ready", "Not ready", "Repair the project", "Detailed repair guidance."],
  ];
  const resources: ResourceResolver = {
    version,
    async readText(uri) {
      assert.equal(uri, manifestUri);
      return JSON.stringify(manifest);
    },
    async readPages(uri) {
      return pages.map(([id, title, description, content]): PageResource => ({
        uri: `${uri}${id}/en-US.md`,
        source: markdown(title, description, content),
      }));
    },
  };
  return { resources };
}

test("loads a serializable Pilot spec and reads searchable documentation", async () => {
  const spec = await loadPilotSpec(manifestUri, fixture().resources);
  assert.equal(spec.objectiveId, manifestUri);
  assert.equal(spec.version, version);
  assert.deepEqual(describeLevels(spec), [
    { objectiveId: manifestUri, levelId: "unready" },
    { objectiveId: manifestUri, levelId: "terminal" },
  ]);
  assert.equal(readPage(spec, "problems/not-ready", "en-US").description, "Repair the project");
  assert.equal(readPage(spec, "missing", "en-US").id, "system/404");
  assert.deepEqual(searchPages(spec, "repair", "en-US"), [
    { id: "problems/not-ready", title: "Not ready" },
  ]);
});

test("observe starts only through startEffect and preserves problem provenance", async () => {
  const spec = await loadPilotSpec(manifestUri, fixture().resources);
  let calls = 0;
  const probe = createMemoryCheckProbe(async (subject) => {
    calls++;
    assert.deepEqual(subject, { root: "project" });
    return {
      status: 200,
      payload: {
        ok: false,
        problems: [{ id: "not-ready", parameters: { path: "config.yaml" } }],
      },
      message: "",
    };
  });
  const effect = observe(
    { spec, subject: { root: "project" }, language: "en-US" },
    { resolveCheck: () => probe },
  );
  assert.equal(calls, 0);
  const envelope = await startEffect(effect).await();
  assert.equal(calls, 1);
  assert.equal(envelope.status, 200);
  assert.ok(envelope.payload);
  assert.deepEqual(envelope.payload.current, {
    objectiveId: manifestUri,
    levelId: "unready",
  });
  assert.deepEqual(envelope.payload.problems, [{
    ref: {
      objectiveId: manifestUri,
      levelId: "unready",
      checkId: "ready",
      problemId: "not-ready",
    },
    parameters: { path: "config.yaml" },
  }]);
});

test("invocation failures remain explicit envelopes", async () => {
  const spec = await loadPilotSpec(manifestUri, fixture().resources);
  const probe = createMemoryCheckProbe(() => {
    throw new Error("offline");
  });
  const envelope = await startEffect(observe(
    { spec, subject: { root: "project" } },
    { resolveCheck: () => probe },
  )).await();
  assert.equal(envelope.status, 502);
  assert.equal(envelope.payload, null);
  assert.match(envelope.message, /offline/);
});

test("cancelling a RunningEffect interrupts the active probe", async () => {
  const spec = await loadPilotSpec(manifestUri, fixture().resources);
  let started!: () => void;
  const active = new Promise<void>((resolve) => { started = resolve; });
  const probe: CheckProbe = async (_subject, signal) => {
    started();
    await new Promise<void>((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    });
    assert.fail("Cancelled probe completed.");
  };
  const running = startEffect(observe(
    { spec, subject: { root: "project" } },
    { resolveCheck: () => probe },
  ));
  await active;
  running.cancel();
  await assert.rejects(running.await());
  assert.equal(running.signal.aborted, true);
});
