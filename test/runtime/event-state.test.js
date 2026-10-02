import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";

import { eventCommand } from "../../src/event-command.js";
import { migrateEvents } from "../../src/migrate-events.js";
import { checkRepository } from "../../src/index.js";
import { createIdea } from "../../src/create-idea.js";
import { listIdeas } from "../../src/list-ideas.js";
import { serializeIdeaEvents } from "../../src/idea-events.js";
import { ideaPaths } from "../../src/layout.js";
import { createRepository, FIRST_ID, SECOND_ID, git } from "../helpers/repository.js";

async function fixture(t, options) {
  const value = await createRepository(options);
  t.after(() => rm(value.base, { recursive: true, force: true }));
  return value;
}

async function migrate(root) {
  const plan = await migrateEvents({ root });
  assert.equal(plan.outcome, "migration-planned");
  const result = await migrateEvents({ root, apply: true, expectedDigest: plan.digest });
  assert.equal(result.outcome, "migrated");
  return result;
}

function publish(root, message) {
  git(root, "add", ".");
  git(root, "commit", "-m", message);
  git(root, "push", "origin", "HEAD:main");
}

async function replay(root) {
  const report = await eventCommand({ root, operation: "replay", idea: FIRST_ID });
  assert.equal(report.observation.state, "event-result", JSON.stringify(report));
  return report.observation.receipt;
}

async function append(root, request, extra = {}) {
  const observed = await replay(root);
  return eventCommand({
    root, operation: "append", idea: FIRST_ID, input: request,
    expectedLength: observed.length, expectedDigest: observed.digest,
    expectedPrimary: observed.baseline.commit, ...extra,
  });
}

test("explicit migration preserves inventory and supplies check evidence for all targets", async (t) => {
  const { root } = await fixture(t);
  const before = await listIdeas({ root });
  const status = await readFile(join(root, ideaPaths(FIRST_ID).statusPath));
  const plan = await migrateEvents({ root });
  assert.deepEqual(await readFile(join(root, ideaPaths(FIRST_ID).statusPath)), status);
  await assert.rejects(migrateEvents({ root, apply: true, expectedDigest: "0".repeat(64) }), /plan changed/);
  await migrateEvents({ root, apply: true, expectedDigest: plan.digest });
  const after = await listIdeas({ root });
  assert.deepEqual(after.observation.ideas, before.observation.ideas);
  assert.equal((await checkRepository({ root, worktree: true })).observation.state, "project-ready");
  git(root, "add", ".");
  assert.equal((await checkRepository({ root, staged: true })).observation.state, "project-ready");
  git(root, "commit", "-m", "Migrate");
  assert.equal((await checkRepository({ root })).observation.state, "project-ready");
  git(root, "push", "origin", "main");
  const remote = await checkRepository({ root, remote: true });
  assert.equal(remote.observation.state, "project-ready", JSON.stringify(remote));
  assert.ok(remote.response.validation.eventHistory.results.some(({ mode }) => mode === "migration"));
  assert.equal((await migrateEvents({ root })).outcome, "already-v2");
});

test("append uses exact CAS, reports retries and rejects no-op duplicates without writing", async (t) => {
  const { root } = await fixture(t);
  await migrate(root);
  publish(root, "Migrate");
  const observed = await replay(root);
  const request = {
    root, operation: "append", idea: FIRST_ID,
    input: { type: "setLanguage", payload: { language: "zh-CN" } },
    expectedLength: observed.length, expectedDigest: observed.digest, expectedPrimary: observed.baseline.commit,
  };
  const written = await eventCommand(request);
  assert.equal(written.observation.receipt?.outcome, "candidate-written", JSON.stringify(written));
  const source = await readFile(join(root, ideaPaths(FIRST_ID).eventsPath));
  assert.equal((await eventCommand(request)).observation.receipt.outcome, "already-present");
  const conflict = await eventCommand({ ...request, input: { type: "setAlias", payload: { alias: "different" } } });
  assert.equal(conflict.observation.state, "check-unavailable");
  assert.equal((await append(root, request.input)).observation.receipt.outcome, "no-state-change");
  assert.deepEqual(await readFile(join(root, ideaPaths(FIRST_ID).eventsPath)), source);
});

test("human decisions require exact synchronized world, explicit confirmation and lifecycle order", async (t) => {
  const { root } = await fixture(t);
  await migrate(root);
  publish(root, "Migrate");
  const paths = ideaPaths(FIRST_ID);
  const idealRevision = git(root, "rev-parse", `HEAD:${paths.idealPath}`);
  const request = { type: "acceptIdeal", payload: { idealRevision } };
  assert.equal((await append(root, request)).observation.state, "check-unavailable");
  const accepted = await append(root, request, { confirmDecision: true });
  assert.equal(accepted.observation.receipt?.outcome, "candidate-written", JSON.stringify(accepted));
  await writeFile(join(root, paths.ideaDocumentPath), "# Changed world\n");
  const updated = git(root, "hash-object", "-w", join(root, paths.ideaDocumentPath));
  assert.equal((await append(root, { type: "acceptIdeal", payload: { idealRevision: updated } },
    { confirmDecision: true })).observation.state, "check-unavailable");
});

test("normal primary prefix is immutable; a reduction-failed base can be repaired and protected again", async (t) => {
  const { root } = await fixture(t);
  await migrate(root);
  publish(root, "Migrate");
  const path = join(root, ideaPaths(FIRST_ID).eventsPath);
  const good = await readFile(path, "utf8");
  await writeFile(path, serializeIdeaEvents([{ sequence: 1, type: "setAlias", payload: { alias: "rewrite" } }]));
  assert.equal((await checkRepository({ root, worktree: true })).observation.state, "check-unavailable");
  await writeFile(path, good + serializeIdeaEvents([{ sequence: 2, type: "setAlias", payload: { alias: "fixture" } }]));
  publish(root, "Deliberately broken primary reducer");
  await writeFile(path, good);
  const repaired = await checkRepository({ root, worktree: true });
  assert.equal(repaired.observation.state, "project-ready", JSON.stringify(repaired));
  assert.equal(repaired.response.validation.eventHistory.results[0].mode, "repair");
  publish(root, "Repair primary");
  assert.equal((await checkRepository({ root, remote: true })).observation.state, "project-ready");
  await writeFile(path, "");
  assert.equal((await checkRepository({ root, worktree: true })).observation.state, "check-unavailable");
});

test("v2 creation writes an empty authoritative log and rejects legacy dual authority", async (t) => {
  const { root } = await fixture(t);
  await migrate(root);
  publish(root, "Migrate");
  const created = await createIdea({ root, generateId: () => SECOND_ID });
  assert.equal(created.observation.state, "idea-created", JSON.stringify(created));
  const paths = ideaPaths(SECOND_ID);
  assert.equal(await readFile(join(root, paths.eventsPath), "utf8"), "");
  await writeFile(join(root, paths.statusPath), `version: 1\nid: ${SECOND_ID}\n`);
  assert.notEqual((await checkRepository({ root, worktree: true })).observation.state, "project-ready");
});

test("migration recovers prepared files and partial switches, or rolls back exact original bytes", async (t) => {
  const module = new URL("../../src/migrate-events.js", import.meta.url).href;
  for (const [stage, rollback] of [
    ["prepared", false],
    [`prepared:${ideaPaths(FIRST_ID).eventsPath}`, false],
    [`applied:${ideaPaths(FIRST_ID).eventsPath}`, true],
    [`applied:${ideaPaths(FIRST_ID).statusPath}`, false],
    ["applied:.silvermoon/config.yaml", true],
    ["applied", false],
  ]) {
    const { root } = await fixture(t);
    const source = await readFile(join(root, ideaPaths(FIRST_ID).statusPath));
    const plan = await migrateEvents({ root });
    const child = spawnSync(process.execPath, ["--input-type=module", "-e", `
      import { migrateEvents } from ${JSON.stringify(module)};
      await migrateEvents({
        root: ${JSON.stringify(root)}, apply: true, expectedDigest: ${JSON.stringify(plan.digest)},
        afterStep: (step) => { if (step === ${JSON.stringify(stage)}) process.exit(77); }
      });
    `], { encoding: "utf8" });
    assert.equal(child.status, 77, child.stderr);
    assert.notEqual((await listIdeas({ root })).observation.state, "ideas-listed");
    const recovered = await migrateEvents({ root, resume: !rollback, rollback, confirmStopped: true });
    assert.equal(recovered.outcome, rollback ? "rolled-back" : "recovered");
    if (rollback) {
      assert.deepEqual(await readFile(join(root, ideaPaths(FIRST_ID).statusPath)), source);
      await migrate(root);
    }
    assert.equal((await listIdeas({ root })).observation.state, "ideas-listed");
    assert.equal((await migrateEvents({ root })).outcome, "already-v2");
  }
});

test("two CLI processes cannot append different events at the same observed position", async (t) => {
  const { root, base } = await fixture(t);
  await migrate(root);
  publish(root, "Migrate");
  const observed = await replay(root);
  const cli = fileURLToPath(new URL("../../bin/silvermoon.js", import.meta.url));
  const requests = ["en", "zh-CN"].map((language, index) => ({
    file: join(base, `request-${index}.json`),
    value: { type: "setLanguage", payload: { language } },
  }));
  await Promise.all(requests.map(({ file, value }) => writeFile(file, JSON.stringify(value))));
  const results = await Promise.all(requests.map(({ file }) => new Promise((done, reject) => {
    const child = spawn(process.execPath, [cli, "event", "append", FIRST_ID, "--root", root,
      "--input", file, "--expected-length", String(observed.length), "--expected-digest", observed.digest,
      "--expected-primary", observed.baseline.commit, "--json"], { windowsHide: true });
    let output = "";
    let error = "";
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { error += chunk; });
    child.on("error", reject);
    child.on("close", (code) => done({ code, output, error }));
  })));
  assert.equal(results.filter(({ code }) => code === 0).length, 1, JSON.stringify(results));
  assert.equal((await replay(root)).reduction.state.sequence, 2);
});

test("revise preserves primary while checks inspect only the selected commit boundary", async (t) => {
  const { root } = await fixture(t);
  await migrate(root);
  publish(root, "Migrate");
  git(root, "checkout", "-b", "candidate");
  assert.equal((await append(root, { type: "setLanguage", payload: { language: "en" } })).observation.receipt.outcome, "candidate-written");
  git(root, "add", ".");
  git(root, "commit", "-m", "First local candidate");
  const observed = await replay(root);
  const revised = await eventCommand({
    root, operation: "revise", idea: FIRST_ID, ownedSuffix: true,
    expectedLength: observed.length, expectedDigest: observed.digest, expectedPrimary: observed.baseline.commit,
    input: [
      { type: "setAlias", payload: { alias: "fixture" } },
      { type: "setLanguage", payload: { language: "zh-CN" } },
    ],
  });
  assert.equal(revised.observation.receipt?.outcome, "candidate-written", JSON.stringify(revised));
  git(root, "add", ".");
  git(root, "commit", "-m", "Revise own candidate");
  assert.equal((await checkRepository({ root })).observation.state, "check-unavailable");
  git(root, "checkout", "main");
  git(root, "merge", "--no-ff", "candidate", "-m", "Integrate reviewed candidate");
  assert.equal((await checkRepository({ root })).observation.state, "project-ready");
});

test("a peer's failed reduction does not unlock a healthy prefix and format failures never permit repair", async (t) => {
  const { root } = await fixture(t, { ideas: [
    { id: FIRST_ID, status: { alias: "first" } },
    { id: SECOND_ID, status: { alias: "second" } },
  ] });
  await migrate(root);
  publish(root, "Migrate two ideas");
  const firstPath = join(root, ideaPaths(FIRST_ID).eventsPath);
  const secondPath = join(root, ideaPaths(SECOND_ID).eventsPath);
  const first = await readFile(firstPath, "utf8");
  const second = await readFile(secondPath, "utf8");
  await writeFile(firstPath, first + serializeIdeaEvents([{ sequence: 2, type: "setAlias", payload: { alias: "first" } }]));
  publish(root, "Break only first reduction");
  await writeFile(firstPath, first);
  await writeFile(secondPath, "");
  assert.equal((await checkRepository({ root, worktree: true })).observation.state, "check-unavailable");
  await writeFile(secondPath, second);
  assert.equal((await checkRepository({ root, worktree: true })).observation.state, "project-ready");
  publish(root, "Repair first");
  await writeFile(firstPath, `${first}{"truncated":`);
  publish(root, "Break format rather than reduction");
  await writeFile(firstPath, first);
  const result = await checkRepository({ root, worktree: true });
  assert.equal(result.observation.state, "check-unavailable");
  assert.match(result.observation.eventHistory.error, /end with LF/);
});

test("world observation is read-only and primary movement invalidates a pending append", async (t) => {
  const { root } = await fixture(t);
  await migrate(root);
  publish(root, "Migrate");
  const paths = ideaPaths(FIRST_ID);
  const request = {
    type: "acceptIdeal", payload: { idealRevision: git(root, "rev-parse", `HEAD:${paths.idealPath}`) },
  };
  await append(root, request, { confirmDecision: true });
  publish(root, "Approve ideal");
  const before = await readFile(join(root, paths.eventsPath));
  const world = await readFile(join(root, paths.ideaDocumentPath));
  await writeFile(join(root, paths.ideaDocumentPath), "# Actually changed\n");
  const changed = await listIdeas({ root });
  assert.equal(changed.observation.ideas[0].state, "preparing");
  assert.deepEqual(await readFile(join(root, paths.eventsPath)), before);
  await writeFile(join(root, paths.ideaDocumentPath), world);
  assert.equal((await listIdeas({ root })).observation.ideas[0].state, "implementing");
  const observed = await replay(root);
  await writeFile(join(root, paths.ledgerPath), "# New continuation evidence\n");
  publish(root, "Advance primary");
  const stale = await eventCommand({
    root, operation: "append", idea: FIRST_ID, input: { type: "setLanguage", payload: { language: "en" } },
    expectedLength: observed.length, expectedDigest: observed.digest, expectedPrimary: observed.baseline.commit,
  });
  assert.equal(stale.observation.state, "check-unavailable");
  assert.match(stale.observation.problems[0].summary, /Primary moved/);
  assert.deepEqual(await readFile(join(root, paths.eventsPath)), before);
});

test("missing tracking refs and shallow missing parents fail closed; committed v1 history stays readable", async (t) => {
  const { root, base, remote } = await fixture(t);
  const legacy = git(root, "rev-parse", "HEAD");
  const original = await readFile(join(root, ideaPaths(FIRST_ID).statusPath));
  const config = await readFile(join(root, ".silvermoon", "config.yaml"));
  await migrate(root);
  publish(root, "Migrate");
  assert.equal((await checkRepository({ root, commit: legacy })).observation.state, "project-ready");
  const shallow = join(base, "shallow");
  git(root, "clone", "--depth=1", pathToFileURL(remote).href, shallow);
  git(shallow, "remote", "set-url", "origin", "https://example.test/owner/repository.git");
  assert.equal((await checkRepository({ root: shallow })).observation.state, "check-unavailable");
  git(root, "update-ref", "-d", "refs/remotes/origin/main");
  assert.equal((await checkRepository({ root })).observation.state, "check-unavailable");
  git(root, "fetch", "origin");
  await rm(join(root, ideaPaths(FIRST_ID).eventsPath));
  await writeFile(join(root, ideaPaths(FIRST_ID).statusPath), original);
  await writeFile(join(root, ".silvermoon", "config.yaml"), config);
  assert.equal((await checkRepository({ root, worktree: true })).observation.state, "check-unavailable");
  git(root, "add", ".");
  git(root, "commit", "-m", "Deliberate invalid downgrade");
  assert.equal((await checkRepository({ root })).observation.state, "check-unavailable");
});

test("event process interruption recovers its exact record; moved primary requires rollback and reobservation", async (t) => {
  const { root } = await fixture(t);
  await migrate(root);
  publish(root, "Migrate");
  const path = ideaPaths(FIRST_ID).eventsPath;
  const module = new URL("../../src/state-transaction.js", import.meta.url).href;
  const before = await readFile(join(root, path), "utf8");
  const after = before + serializeIdeaEvents([{ sequence: 2, type: "setLanguage", payload: { language: "en" } }]);
  const context = {
    id: FIRST_ID, storage: "segmented", primary: git(root, "rev-parse", "origin/main"),
    revisions: {
      idealRevision: git(root, "rev-parse", `HEAD:${ideaPaths(FIRST_ID).idealPath}`),
      implementationRevision: git(root, "rev-parse", `HEAD:${ideaPaths(FIRST_ID).innerPath}`),
      deploymentRevision: git(root, "rev-parse", `HEAD:${ideaPaths(FIRST_ID).outerPath}`),
    },
  };
  const interrupt = () => {
    const child = spawnSync(process.execPath, ["--input-type=module", "-e", `
      import { stateTransaction } from ${JSON.stringify(module)};
      await stateTransaction(${JSON.stringify(root)}, "events", [{
        path: ${JSON.stringify(path)}, before: ${JSON.stringify(before)}, after: ${JSON.stringify(after)}
      }], {
        context: ${JSON.stringify(context)},
        afterStep: (step) => { if (step === ${JSON.stringify(`prepared:${path}`)}) process.exit(77); }
      });
    `], { encoding: "utf8" });
    assert.equal(child.status, 77, child.stderr);
  };
  interrupt();
  const result = await eventCommand({ root, operation: "recover", confirmStopped: true });
  assert.equal(result.observation.receipt?.outcome, "recovered", JSON.stringify(result));
  assert.equal(await readFile(join(root, path), "utf8"), after);
  // This is an operation-owned unintegrated candidate in an isolated fixture.
  await writeFile(join(root, path), before);
  interrupt();
  await writeFile(join(root, "unrelated.txt"), "Move primary without changing worlds\n");
  git(root, "add", "unrelated.txt");
  git(root, "commit", "-m", "Concurrent primary");
  git(root, "push", "origin", "HEAD:main");
  const stale = await eventCommand({ root, operation: "recover", confirmStopped: true });
  assert.equal(stale.observation.state, "check-unavailable");
  assert.match(stale.observation.problems[0].summary, /Primary moved/);
  const rollback = await eventCommand({ root, operation: "recover", confirmStopped: true, rollback: true });
  assert.equal(rollback.observation.receipt.outcome, "rolled-back");
  assert.equal(await readFile(join(root, path), "utf8"), before);
});

test("migration recovery refuses unknown changed bytes without overwriting them", async (t) => {
  const { root } = await fixture(t);
  const module = new URL("../../src/migrate-events.js", import.meta.url).href;
  const plan = await migrateEvents({ root });
  const child = spawnSync(process.execPath, ["--input-type=module", "-e", `
    import { migrateEvents } from ${JSON.stringify(module)};
    await migrateEvents({ root: ${JSON.stringify(root)}, apply: true,
      expectedDigest: ${JSON.stringify(plan.digest)},
      afterStep: (step) => { if (step === "prepared") process.exit(77); }
    });
  `], { encoding: "utf8" });
  assert.equal(child.status, 77, child.stderr);
  const path = join(root, ideaPaths(FIRST_ID).statusPath);
  await writeFile(path, "Unknown concurrent content\n");
  await assert.rejects(migrateEvents({ root, resume: true, confirmStopped: true }), /unknown content was preserved/);
  assert.equal(await readFile(path, "utf8"), "Unknown concurrent content\n");
});

test("migration rechecks each source after earlier writes, not just at preflight", async (t) => {
  const { root } = await fixture(t);
  const plan = await migrateEvents({ root });
  const paths = ideaPaths(FIRST_ID);
  await assert.rejects(migrateEvents({
    root, apply: true, expectedDigest: plan.digest,
    afterStep: async (step) => {
      if (step === `applied:${paths.eventsPath}`) {
        await writeFile(join(root, paths.statusPath), "Concurrent edit after preflight\n");
      }
    },
  }), /unknown content was preserved/);
  assert.equal(await readFile(join(root, paths.statusPath), "utf8"), "Concurrent edit after preflight\n");
});
