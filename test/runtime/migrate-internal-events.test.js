import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { checkRepository } from "../../src/index.js";
import { detectEventFormat } from "../../src/event-history.js";
import { parseIdeaEvents, serializeIdeaEvents } from "../../src/idea-events.js";
import { worktreeSnapshot } from "../../src/git.js";
import { migrateInternalEvents } from "../../src/migrate-internal-events.js";
import { ideaPaths } from "../../src/layout.js";
import { createRepository, FIRST_ID, SECOND_ID, git } from "../helpers/repository.js";

const SOURCE_REPOSITORY = "https://github.com/shazhou-ww/silvermoon.git";

async function fixture(t, {
  ideas = [{ id: FIRST_ID, status: { alias: "fixture" } }],
  final = false,
} = {}) {
  const value = await createRepository({ ideas });
  t.after(() => rm(value.base, { recursive: true, force: true }));
  const { root, remote } = value;
  git(root, "config", `url.file://${remote}.insteadOf`, SOURCE_REPOSITORY);
  git(root, "remote", "set-url", "origin", SOURCE_REPOSITORY);
  await writeFile(join(root, ".silvermoon/config.yaml"),
    `version: 2\nprimaryRepository: ${SOURCE_REPOSITORY}\nprimaryBranch: main\n`);
  for (const { id, status } of ideas) {
    const paths = ideaPaths(id);
    await rm(join(root, paths.statusPath));
    await writeFile(join(root, paths.eventsPath), serializeIdeaEvents(
      status.alias ? [{
        sequence: 1, type: final ? "setAlias" : "alias.updated", payload: { alias: status.alias },
      }] : [],
      { legacy: !final },
    ));
  }
  publish(root, "Internal legacy event fixture");
  return root;
}

function publish(root, message) {
  git(root, "add", ".");
  git(root, "commit", "-m", message);
  git(root, "push", "origin", "HEAD:main");
}

test("internal migration plans without writes and preserves legacy records across the boundary", async (t) => {
  const root = await fixture(t);
  const path = join(root, ideaPaths(FIRST_ID).eventsPath);
  const events = [
    ...parseIdeaEvents(await readFile(path), { legacy: true }),
    { sequence: 2, type: "language.updated", payload: { language: "en" } },
    { sequence: 3, type: "idea.abandoned" },
    { sequence: 4, type: "idea.resumed" },
    { sequence: 5, type: "ideal.approved", payload: {
      idealRevision: git(root, "rev-parse", `HEAD:${ideaPaths(FIRST_ID).idealPath}`),
    } },
    { sequence: 6, type: "implementation.accepted", payload: {
      implementationRevision: git(root, "rev-parse", `HEAD:${ideaPaths(FIRST_ID).innerPath}`),
    } },
    { sequence: 7, type: "deployment.accepted", payload: {
      deploymentRevision: git(root, "rev-parse", `HEAD:${ideaPaths(FIRST_ID).outerPath}`),
    } },
  ];
  await writeFile(path, serializeIdeaEvents(events, { legacy: true }));
  publish(root, "Append legacy events");
  const before = await readFile(path);
  const plan = await migrateInternalEvents({ root });
  assert.equal(plan.outcome, "migration-planned");
  assert.deepEqual(await readFile(path), before);
  await assert.rejects(migrateInternalEvents({ root, apply: true, expectedDigest: "0".repeat(64) }), /plan changed/);
  await migrateInternalEvents({ root, apply: true, expectedDigest: plan.digest });
  assert.deepEqual(parseIdeaEvents(await readFile(path)).map(({ type }) => type),
    ["setAlias", "setLanguage", "abandon", "resume", "acceptIdeal", "acceptInner", "acceptOuter"]);
  assert.match(await readFile(join(root, ".silvermoon/config.yaml"), "utf8"), /^version: 2\n/);
  const candidate = await checkRepository({ root, worktree: true });
  assert.equal(candidate.observation.state, "project-ready", JSON.stringify(candidate.observation));
  git(root, "add", ".");
  const staged = await checkRepository({ root, staged: true });
  assert.equal(staged.observation.state, "project-ready", JSON.stringify(staged.observation));
  publish(root, "Convert internal events");
  const report = await checkRepository({ root, remote: true });
  assert.equal(report.observation.state, "project-ready", JSON.stringify(report.observation));
  assert.ok(report.response.validation.eventHistory.history.some(({ mode }) => mode === "migration-final"));
  assert.ok(report.response.validation.eventHistory.history.some(({ mode }) => mode === "migration"));
  await assert.rejects(migrateInternalEvents({ root }), /unsupported event type|legacy/);
  await writeFile(path, Buffer.concat([
    await readFile(path),
    Buffer.from(serializeIdeaEvents([{ sequence: 8, type: "setAlias", payload: { alias: "later" } }])),
  ]));
  assert.equal((await checkRepository({ root, worktree: true })).observation.state, "project-ready");
});

test("migration converts all ideas including empty logs and rejects partial conversions", async (t) => {
  const root = await fixture(t, { ideas: [
    { id: FIRST_ID, status: { alias: "first" } },
    { id: SECOND_ID, status: {} },
  ] });
  const plan = await migrateInternalEvents({ root });
  assert.deepEqual(new Set(plan.ideas), new Set([FIRST_ID, SECOND_ID]));
  await migrateInternalEvents({ root, apply: true, expectedDigest: plan.digest });
  assert.equal(await readFile(join(root, ideaPaths(SECOND_ID).eventsPath), "utf8"), "");
  assert.equal((await checkRepository({ root, worktree: true })).observation.state, "project-ready");
  await writeFile(join(root, ideaPaths(FIRST_ID).eventsPath), serializeIdeaEvents([
    { sequence: 1, type: "setAlias", payload: { alias: "rewritten" } },
  ]));
  publish(root, "Invalid conversion");
  const report = await checkRepository({ root, remote: true });
  assert.equal(report.observation.state, "check-unavailable");
  assert.match(report.observation.eventHistory.error, /exact type rename/);
});

test("migration rejects invalid abandoned windows and empty-only ambiguous boundaries", async (t) => {
  const root = await fixture(t);
  const path = join(root, ideaPaths(FIRST_ID).eventsPath);
  await writeFile(path, serializeIdeaEvents([
    ...parseIdeaEvents(await readFile(path), { legacy: true }),
    { sequence: 2, type: "idea.abandoned" },
    { sequence: 3, type: "language.updated", payload: { language: "en" } },
  ], { legacy: true }));
  await assert.rejects(migrateInternalEvents({ root }), /invalid historical event 3: abandoned/);
  const empty = await fixture(t, { ideas: [{ id: FIRST_ID, status: {} }] });
  assert.equal(await detectEventFormat({
    root: empty, tree: worktreeSnapshot(empty).tree,
  }), "legacy");
  await assert.rejects(migrateInternalEvents({ root: empty }), /every idea log is empty/);
});

test("detector inherits source format for empty logs and rejects external dotted logs", async (t) => {
  const root = await fixture(t);
  const path = ideaPaths(FIRST_ID).eventsPath;
  const tree = worktreeSnapshot(root).tree;
  assert.equal(await detectEventFormat({ root, tree }), "legacy");
  await writeFile(join(root, path), "");
  assert.equal(await detectEventFormat({ root, tree: worktreeSnapshot(root).tree }), "legacy");
  const original = await readFile(join(root, path));
  const overrides = new Map([[path, original]]);
  assert.equal(await detectEventFormat({ root, tree, overrides }), "legacy");
});

test("external version 2 projects cannot use the internal legacy migration", async (t) => {
  const { root, base } = await createRepository();
  t.after(() => rm(base, { recursive: true, force: true }));
  await assert.rejects(migrateInternalEvents({ root }), /restricted to the Silvermoon source repository/);
  const path = ideaPaths(FIRST_ID);
  await writeFile(join(root, ".silvermoon/config.yaml"),
    "version: 2\nprimaryRepository: https://example.test/owner/repository.git\nprimaryBranch: main\n");
  await rm(join(root, path.statusPath));
  await writeFile(join(root, path.eventsPath), serializeIdeaEvents([
    { sequence: 1, type: "alias.updated", payload: { alias: "fixture" } },
  ], { legacy: true }));
  publish(root, "External dotted events are not compatible");
  const report = await checkRepository({ root, remote: true });
  assert.equal(report.observation.state, "check-unavailable");
  assert.match(report.observation.eventHistory.error, /only supported in the Silvermoon source repository/);
});

test("internal migration requires clean fetched primary and the exact plan digest", async (t) => {
  const root = await fixture(t);
  git(root, "commit", "--allow-empty", "-m", "Unintegrated candidate");
  const plan = await migrateInternalEvents({ root });
  await assert.rejects(migrateInternalEvents({ root, apply: true, expectedDigest: plan.digest }),
    /fetched primary tip/);
  git(root, "push", "origin", "HEAD:main");
  await writeFile(join(root, "unrelated.txt"), "Pending work\n");
  const dirty = await migrateInternalEvents({ root });
  await assert.rejects(migrateInternalEvents({ root, apply: true, expectedDigest: dirty.digest }),
    /clean committed source/);
});

test("migration refuses an invalid legacy first-parent history", async (t) => {
  const root = await fixture(t);
  const path = join(root, ideaPaths(FIRST_ID).eventsPath);
  await writeFile(path, serializeIdeaEvents([
    { sequence: 1, type: "alias.updated", payload: { alias: "rewritten" } },
  ], { legacy: true }));
  publish(root, "Rewrite legacy prefix");
  await assert.rejects(migrateInternalEvents({ root }), /not-append-only/);
});

test("final history refuses rewrites and repair after a failed reducer", async (t) => {
  const root = await fixture(t);
  const plan = await migrateInternalEvents({ root });
  await migrateInternalEvents({ root, apply: true, expectedDigest: plan.digest });
  publish(root, "Convert internal events");
  const path = join(root, ideaPaths(FIRST_ID).eventsPath);
  const original = await readFile(path, "utf8");
  await writeFile(path, serializeIdeaEvents([
    { sequence: 1, type: "setAlias", payload: { alias: "rewritten" } },
  ]));
  assert.match((await checkRepository({ root, worktree: true })).observation.eventHistory.error, /not-append-only/);
  await writeFile(path, original + serializeIdeaEvents([
    { sequence: 2, type: "setAlias", payload: { alias: "fixture" } },
  ]));
  publish(root, "Broken final reducer");
  await writeFile(path, original);
  assert.match((await checkRepository({ root, worktree: true })).observation.eventHistory.error,
    /final event history must remain append-only/);
});

test("source projects created directly with final v2 retain ordinary failed-reducer repair", async (t) => {
  const root = await fixture(t, { final: true });
  const path = join(root, ideaPaths(FIRST_ID).eventsPath);
  const before = await readFile(path, "utf8");
  await writeFile(path, before + serializeIdeaEvents([
    { sequence: 2, type: "setAlias", payload: { alias: "fixture" } },
  ]));
  publish(root, "Break a directly final v2 reducer");
  await writeFile(path, before);
  const report = await checkRepository({ root, worktree: true });
  assert.equal(report.observation.state, "project-ready", JSON.stringify(report.observation));
  assert.equal(report.response.validation.eventHistory.results[0].mode, "repair");
});

test("standalone command and interrupted transaction recover or roll back exact bytes", async (t) => {
  const cli = fileURLToPath(new URL("../../bin/migrate-internal-events.js", import.meta.url));
  const module = new URL("../../src/migrate-internal-events.js", import.meta.url).href;
  for (const rollback of [true, false]) {
    const root = await fixture(t);
    const run = (...args) => spawnSync(process.execPath, [cli, "--root", root, ...args], { encoding: "utf8" });
    const planned = run();
    assert.equal(planned.status, 0, planned.stderr);
    const plan = JSON.parse(planned.stdout);
    assert.equal(plan.outcome, "migration-planned");
    assert.match(run("--apply").stderr, /plan changed/);
    const path = join(root, ideaPaths(FIRST_ID).eventsPath);
    const before = await readFile(path);
    const child = spawnSync(process.execPath, ["--input-type=module", "-e", `
      import { migrateInternalEvents } from ${JSON.stringify(module)};
      await migrateInternalEvents({
        root: ${JSON.stringify(root)}, apply: true, expectedDigest: ${JSON.stringify(plan.digest)},
        afterStep: (step) => { if (step === "prepared") process.exit(77); }
      });
    `], { encoding: "utf8" });
    assert.equal(child.status, 77, child.stderr);
    const recovered = await migrateInternalEvents({
      root, rollback, resume: !rollback, confirmStopped: true,
    });
    assert.equal(recovered.outcome, rollback ? "rolled-back" : "recovered");
    if (rollback) {
      assert.deepEqual(await readFile(path), before);
      const applied = run("--apply", "--expected-digest", plan.digest);
      assert.equal(applied.status, 0, applied.stderr);
      assert.equal(JSON.parse(applied.stdout).outcome, "migrated");
    } else {
      assert.deepEqual(parseIdeaEvents(await readFile(path)).map(({ type }) => type), ["setAlias"]);
    }
  }
});

test("interrupted migration refuses resume after primary moves but allows rollback", async (t) => {
  const root = await fixture(t);
  const plan = await migrateInternalEvents({ root });
  const path = join(root, ideaPaths(FIRST_ID).eventsPath);
  const before = await readFile(path);
  const module = new URL("../../src/migrate-internal-events.js", import.meta.url).href;
  const child = spawnSync(process.execPath, ["--input-type=module", "-e", `
    import { migrateInternalEvents } from ${JSON.stringify(module)};
    await migrateInternalEvents({
      root: ${JSON.stringify(root)}, apply: true, expectedDigest: ${JSON.stringify(plan.digest)},
      afterStep: (step) => { if (step === "prepared") process.exit(77); }
    });
  `], { encoding: "utf8" });
  assert.equal(child.status, 77, child.stderr);
  const moved = git(root, "commit-tree", git(root, "rev-parse", "HEAD^{tree}"),
    "-p", git(root, "rev-parse", "HEAD"), "-m", "Moved primary");
  git(root, "push", "origin", `${moved}:main`);
  await assert.rejects(migrateInternalEvents({ root, resume: true, confirmStopped: true }),
    /Primary moved/);
  assert.equal((await migrateInternalEvents({ root, rollback: true, confirmStopped: true })).outcome, "rolled-back");
  assert.deepEqual(await readFile(path), before);
});
