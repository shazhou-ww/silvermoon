import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { checkRepository } from "../../src/index.js";
import { parseIdeaEvents, serializeIdeaEvents } from "../../src/idea-events.js";
import { migrateEvents } from "../../src/migrate-events.js";
import { migrateV2ToV3 } from "../../src/migrate-v3-events.js";
import { ideaPaths } from "../../src/layout.js";
import { createRepository, FIRST_ID, SECOND_ID, git } from "../helpers/repository.js";

async function fixture(t, options) {
  const value = await createRepository(options);
  t.after(() => rm(value.base, { recursive: true, force: true }));
  const plan = await migrateEvents({ root: value.root });
  await migrateEvents({ root: value.root, apply: true, expectedDigest: plan.digest });
  git(value.root, "add", ".");
  git(value.root, "commit", "-m", "Migrate to v2");
  git(value.root, "push", "origin", "HEAD:main");
  return value.root;
}

function publish(root, message) {
  git(root, "add", ".");
  git(root, "commit", "-m", message);
  git(root, "push", "origin", "HEAD:main");
}

test("v2-to-v3 plan preserves all records, status, sequence and historical v2 audit", async (t) => {
  const root = await fixture(t);
  const path = join(root, ideaPaths(FIRST_ID).eventsPath);
  const original = await readFile(path);
  const events = [
    ...parseIdeaEvents(original),
    { sequence: 2, type: "language.updated", payload: { language: "en" } },
    { sequence: 3, type: "idea.abandoned" },
    { sequence: 4, type: "idea.resumed" },
    { sequence: 5, type: "ideal.approved", payload: {
      idealRevision: git(root, "rev-parse", `HEAD:${ideaPaths(FIRST_ID).idealPath}`),
    } },
  ];
  await writeFile(path, serializeIdeaEvents(events));
  publish(root, "Append v2 events");
  const plan = await migrateV2ToV3({ root });
  assert.equal(plan.outcome, "migration-planned");
  assert.deepEqual(await readFile(path), Buffer.from(serializeIdeaEvents(events)));
  await assert.rejects(migrateV2ToV3({ root, apply: true, expectedDigest: "0".repeat(64) }), /plan changed/);
  const applied = await migrateV2ToV3({ root, apply: true, expectedDigest: plan.digest });
  assert.equal(applied.outcome, "migrated");
  assert.deepEqual(parseIdeaEvents(await readFile(path), { version: 3 }).map(({ type }) => type),
    ["setAlias", "setLanguage", "abandon", "resume", "approveIdeal"]);
  assert.equal((await migrateV2ToV3({ root })).outcome, "already-v3");
  const candidate = await checkRepository({ root, worktree: true });
  assert.equal(candidate.observation.state, "project-ready", JSON.stringify(candidate.observation));
  publish(root, "Migrate to v3");
  const report = await checkRepository({ root, remote: true });
  assert.equal(report.observation.state, "project-ready", JSON.stringify(report.observation));
  assert.ok(report.response.validation.eventHistory.history.some(({ mode }) => mode === "migration-v3"));
  assert.ok(report.response.validation.eventHistory.history.some(({ mode }) => mode === "migration"));
  await writeFile(path, Buffer.concat([
    await readFile(path),
    Buffer.from(serializeIdeaEvents([{ sequence: 6, type: "setAlias", payload: { alias: "later" } }], { version: 3 })),
  ]));
  assert.equal((await checkRepository({ root, worktree: true })).observation.state, "project-ready");
});

test("migration converts every idea in one exact plan", async (t) => {
  const root = await fixture(t, { ideas: [
    { id: FIRST_ID, status: { alias: "first" } },
    { id: SECOND_ID, status: { alias: "second" } },
  ] });
  const plan = await migrateV2ToV3({ root });
  assert.deepEqual(new Set(plan.ideas), new Set([FIRST_ID, SECOND_ID]));
  await migrateV2ToV3({ root, apply: true, expectedDigest: plan.digest });
  for (const id of [FIRST_ID, SECOND_ID]) {
    const events = parseIdeaEvents(await readFile(join(root, ideaPaths(id).eventsPath)), { version: 3 });
    assert.equal(events[0].type, "setAlias");
  }
  assert.equal((await checkRepository({ root, worktree: true })).observation.state, "project-ready");
});

test("migration rejects a committed source not at the fetched primary tip", async (t) => {
  const root = await fixture(t);
  git(root, "commit", "--allow-empty", "-m", "Unintegrated candidate");
  const plan = await migrateV2ToV3({ root });
  await assert.rejects(
    migrateV2ToV3({ root, apply: true, expectedDigest: plan.digest }),
    /fetched primary tip/,
  );
});

test("migration rejects v2 histories that v3 would forbid during an abandoned window", async (t) => {
  const root = await fixture(t);
  const path = join(root, ideaPaths(FIRST_ID).eventsPath);
  const events = [
    ...parseIdeaEvents(await readFile(path)),
    { sequence: 2, type: "idea.abandoned" },
    { sequence: 3, type: "language.updated", payload: { language: "en" } },
  ];
  await writeFile(path, serializeIdeaEvents(events));
  const before = await readFile(path);
  await assert.rejects(migrateV2ToV3({ root }), /invalid historical event 3: abandoned/);
  assert.deepEqual(await readFile(path), before);
});

test("history rejects rewritten records at the v2-to-v3 boundary", async (t) => {
  const root = await fixture(t);
  const plan = await migrateV2ToV3({ root });
  await migrateV2ToV3({ root, apply: true, expectedDigest: plan.digest });
  const path = join(root, ideaPaths(FIRST_ID).eventsPath);
  await writeFile(path, serializeIdeaEvents([
    { sequence: 1, type: "setAlias", payload: { alias: "rewritten" } },
  ], { version: 3 }));
  publish(root, "Invalid v3 migration");
  const result = await checkRepository({ root, remote: true });
  assert.equal(result.observation.state, "check-unavailable");
  assert.match(result.observation.eventHistory.error, /exact type rename/);
});

test("v3 history rejects non-append changes after the migration boundary", async (t) => {
  const root = await fixture(t);
  const plan = await migrateV2ToV3({ root });
  await migrateV2ToV3({ root, apply: true, expectedDigest: plan.digest });
  publish(root, "Migrate to v3");
  const path = join(root, ideaPaths(FIRST_ID).eventsPath);
  await writeFile(path, serializeIdeaEvents([
    { sequence: 1, type: "setAlias", payload: { alias: "rewritten" } },
  ], { version: 3 }));
  const result = await checkRepository({ root, worktree: true });
  assert.equal(result.observation.state, "check-unavailable");
  assert.match(result.observation.eventHistory.error, /not-append-only/);
});

test("v3 history does not grant repair permission for a failed primary reducer", async (t) => {
  const root = await fixture(t);
  const plan = await migrateV2ToV3({ root });
  await migrateV2ToV3({ root, apply: true, expectedDigest: plan.digest });
  publish(root, "Migrate to v3");
  const path = join(root, ideaPaths(FIRST_ID).eventsPath);
  const original = await readFile(path, "utf8");
  await writeFile(path, original + serializeIdeaEvents([
    { sequence: 2, type: "setAlias", payload: { alias: "fixture" } },
  ], { version: 3 }));
  publish(root, "Broken v3 reducer");
  await writeFile(path, original);
  const result = await checkRepository({ root, worktree: true });
  assert.equal(result.observation.state, "check-unavailable");
  assert.match(result.observation.eventHistory.error, /v3 history must remain append-only/);
});

test("standalone migration CLI plans without writes and requires its exact digest", async (t) => {
  const root = await fixture(t);
  const cli = fileURLToPath(new URL("../../bin/migrate-v2-to-v3.js", import.meta.url));
  const run = (...args) => spawnSync(process.execPath, [cli, "--root", root, ...args], { encoding: "utf8" });
  const path = join(root, ideaPaths(FIRST_ID).eventsPath);
  const before = await readFile(path);
  const planned = run();
  assert.equal(planned.status, 0, planned.stderr);
  const plan = JSON.parse(planned.stdout);
  assert.equal(plan.outcome, "migration-planned");
  assert.deepEqual(await readFile(path), before);
  const missingDigest = run("--apply");
  assert.equal(missingDigest.status, 1);
  assert.match(missingDigest.stderr, /plan changed/);
  const applied = run("--apply", "--expected-digest", plan.digest);
  assert.equal(applied.status, 0, applied.stderr);
  assert.equal(JSON.parse(applied.stdout).outcome, "migrated");
});

test("interrupted v3 migration recovers or rolls back exact bytes", async (t) => {
  const module = new URL("../../src/migrate-v3-events.js", import.meta.url).href;
  for (const rollback of [false, true]) {
    const root = await fixture(t);
    const path = join(root, ideaPaths(FIRST_ID).eventsPath);
    const before = await readFile(path);
    const plan = await migrateV2ToV3({ root });
    const child = spawnSync(process.execPath, ["--input-type=module", "-e", `
      import { migrateV2ToV3 } from ${JSON.stringify(module)};
      await migrateV2ToV3({
        root: ${JSON.stringify(root)}, apply: true, expectedDigest: ${JSON.stringify(plan.digest)},
        afterStep: (step) => { if (step === "prepared") process.exit(77); }
      });
    `], { encoding: "utf8" });
    assert.equal(child.status, 77, child.stderr);
    const recovered = await migrateV2ToV3({ root, rollback, resume: !rollback, confirmStopped: true });
    assert.equal(recovered.outcome, rollback ? "rolled-back" : "recovered");
    if (rollback) {
      assert.deepEqual(await readFile(path), before);
      assert.equal((await migrateV2ToV3({ root })).digest, plan.digest);
    } else {
      assert.equal((await migrateV2ToV3({ root })).outcome, "already-v3");
    }
  }
});
