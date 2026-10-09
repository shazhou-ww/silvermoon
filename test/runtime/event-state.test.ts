import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";

import { eventCommand } from "../../src/business/event-command.ts";
import { migrateEvents } from "../../src/business/migrate-v1-to-v2.ts";
import { runSchemaMigration } from "../../src/business/schema-migration.ts";
import { checkRepository } from "../../src/index.ts";
import { createIdea } from "../../src/business/create-idea.ts";
import { listIdeas } from "../../src/business/list-ideas.ts";
import { serializeIdeaEvents } from "../../src/foundation/event-codec/index.ts";
import { ideaPaths } from "../../src/foundation/coordinates/index.ts";
import type { EventReceipt } from "../../src/foundation/report/types.ts";
import type { RepositoryFixtureOptions } from "../helpers/repository.ts";
import { createRepository, FIRST_ID, SECOND_ID, git } from "../helpers/repository.ts";

type AppendRequest =
  | { type: "submitIdeal"; payload: { idealRevision: string } }
  | { type: "acceptIdeal"; payload: { idealRevision: string } }
  | { type: "setLanguage"; payload: { language: string } };

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

function migrationDigest(result: Awaited<ReturnType<typeof migrateEvents>>): string {
  assert.equal(result.outcome, "migration-planned");
  assert.ok("digest" in result);
  return result.digest;
}

function replayReceipt(receipt: EventReceipt) {
  const baseline = requiredRecord(receipt.baseline, "baseline");
  const reduction = requiredRecord(receipt.reduction, "reduction");
  const state = requiredRecord(reduction.state, "reduction.state");
  return {
    ...receipt,
    baseline: {
      ...baseline,
      commit: requiredString(baseline.commit, "baseline.commit"),
    },
    digest: requiredString(receipt.digest, "digest"),
    length: requiredNumber(receipt.length, "length"),
    reduction: {
      ...reduction,
      state: {
        ...state,
        sequence: requiredNumber(state.sequence, "reduction.state.sequence"),
      },
    },
  };
}

function eventReceipt(report: Awaited<ReturnType<typeof eventCommand>>) {
  assert.equal(report.observation.state, "event-result", JSON.stringify(report));
  if (report.observation.state !== "event-result") {
    throw new Error("Expected an event-result observation");
  }
  return report.observation.receipt;
}

function firstProblem(report: Awaited<ReturnType<typeof eventCommand>>) {
  const problem = report.observation.problems[0];
  assert.ok(problem, "Expected a reported problem");
  return problem;
}

function listedIdeas(report: Awaited<ReturnType<typeof listIdeas>>) {
  assert.equal(report.observation.state, "ideas-listed", JSON.stringify(report));
  if (report.observation.state !== "ideas-listed") {
    throw new Error("Expected an ideas-listed observation");
  }
  return report.observation.ideas;
}

function validationResults(report: Awaited<ReturnType<typeof checkRepository>>) {
  const response = requiredRecord(report.response, "response");
  const validation = requiredRecord(response.validation, "response.validation");
  const eventHistory = requiredRecord(validation.eventHistory, "response.validation.eventHistory");
  const results = eventHistory.results;
  assert.ok(Array.isArray(results), "response.validation.eventHistory.results must be an array");
  return results.map((result, index) =>
    requiredRecord(result, `response.validation.eventHistory.results[${index}]`));
}

async function fixture(t: test.TestContext, options?: RepositoryFixtureOptions) {
  const value = await createRepository(options);
  t.after(() => rm(value.base, { recursive: true, force: true }));
  return value;
}

async function migrate(root: string) {
  const plan = await migrateEvents({ root });
  const digest = migrationDigest(plan);
  const result = await migrateEvents({ root, apply: true, expectedDigest: digest });
  assert.equal(result.outcome, "migrated");
  return result;
}

function publish(root: string, message: string) {
  git(root, "add", ".");
  git(root, "commit", "-m", message);
  git(root, "push", "origin", "HEAD:main");
}

async function replay(root: string) {
  const report = await eventCommand({ root, operation: "replay", idea: FIRST_ID, input: null });
  assert.equal(report.observation.state, "event-result", JSON.stringify(report));
  if (report.observation.state !== "event-result") {
    throw new Error("Expected an event-result observation");
  }
  return replayReceipt(report.observation.receipt);
}

async function append(
  root: string,
  request: AppendRequest,
  extra: { confirmDecision?: boolean } = {},
) {
  const observed = await replay(root);
  return eventCommand({
    root, operation: "append", idea: FIRST_ID, input: request,
    expectedDigest: observed.digest,
    expectedPrimary: observed.baseline.commit, ...extra,
  });
}

test("explicit migration preserves inventory and supplies check evidence for all targets", async (t) => {
  const { root } = await fixture(t);
  const before = await listIdeas({ root });
  const status = await readFile(join(root, ideaPaths(FIRST_ID).statusPath));
  const plan = await runSchemaMigration("project-v1-to-v2", { root });
  assert.equal(plan.migrationId, "project-v1-to-v2");
  assert.deepEqual(await readFile(join(root, ideaPaths(FIRST_ID).statusPath)), status);
  await assert.rejects(
    runSchemaMigration("project-v1-to-v2", {
      root,
      apply: true,
      expectedDigest: "0".repeat(64),
    }),
    /plan changed/,
  );
  await runSchemaMigration("project-v1-to-v2", {
    root,
    apply: true,
    expectedDigest: migrationDigest(plan),
  });
  const after = await listIdeas({ root });
  assert.deepEqual(listedIdeas(after), listedIdeas(before));
  assert.equal((await checkRepository({ root, worktree: true })).observation.state, "project-ready");
  git(root, "add", ".");
  assert.equal((await checkRepository({ root, staged: true })).observation.state, "project-ready");
  git(root, "commit", "-m", "Migrate");
  assert.equal((await checkRepository({ root })).observation.state, "project-ready");
  git(root, "push", "origin", "main");
  const remote = await checkRepository({ root, remote: true });
  assert.equal(remote.observation.state, "project-ready", JSON.stringify(remote));
  assert.ok(validationResults(remote).some(({ mode }) => mode === "migration"));
  assert.equal(
    (await runSchemaMigration("project-v1-to-v2", { root })).outcome,
    "already-v2",
  );
});

test("append uses optional digest prefixes, reports retries and rejects invalid CAS without writing", async (t) => {
  const { root } = await fixture(t);
  await migrate(root);
  publish(root, "Migrate");
  const observed = await replay(root);
  const request = {
    root, operation: "append", idea: FIRST_ID,
    input: { type: "setLanguage", payload: { language: "zh-CN" } },
    expectedDigest: observed.digest.slice(0, 8), expectedPrimary: observed.baseline.commit,
  } satisfies Parameters<typeof eventCommand>[0];
  const written = await eventCommand(request);
  assert.equal(eventReceipt(written).outcome, "candidate-written", JSON.stringify(written));
  const source = await readFile(join(root, ideaPaths(FIRST_ID).eventsPath));
  const retry = eventReceipt(await eventCommand(request));
  assert.equal(retry.outcome, "already-present");
  assert.equal(retry.written, false);
  assert.equal(retry.timestamp, eventReceipt(written).timestamp);
  const short = await eventCommand({ ...request, expectedDigest: observed.digest.slice(0, 7) });
  assert.equal(short.observation.state, "check-unavailable");
  assert.match(short.observation.problems.at(0)?.summary ?? "", /8 to 40/);
  const conflict = await eventCommand({ ...request, input: { type: "setAlias", payload: { alias: "different" } } });
  assert.equal(conflict.observation.state, "check-unavailable");
  assert.equal(eventReceipt(await append(root, {
    type: "setLanguage",
    payload: request.input.payload,
  })).outcome, "no-state-change");
  assert.deepEqual(await readFile(join(root, ideaPaths(FIRST_ID).eventsPath)), source);
});

test("append accepts intermediate, full and omitted digest CAS inputs", async (t) => {
  const { root } = await fixture(t);
  await migrate(root);
  publish(root, "Migrate");
  const appendAlias = async (alias: string, expectedDigest?: string) => {
    const observed = await replay(root);
    const report = await eventCommand({
      root,
      operation: "append",
      idea: FIRST_ID,
      input: { type: "setAlias", payload: { alias } },
      ...(expectedDigest === undefined ? {} : { expectedDigest }),
      expectedPrimary: observed.baseline.commit,
    });
    assert.equal(report.observation.state, "event-result", JSON.stringify(report));
    return eventReceipt(report);
  };
  const first = await replay(root);
  assert.equal((await appendAlias("eight", first.digest.slice(0, 8))).outcome, "candidate-written");
  const second = await replay(root);
  assert.equal((await appendAlias("intermediate", second.digest.slice(0, 20))).outcome, "candidate-written");
  const third = await replay(root);
  assert.equal((await appendAlias("full", third.digest)).outcome, "candidate-written");
  assert.equal((await appendAlias("omitted")).outcome, "candidate-written");
});

test("human decisions require exact synchronized world, explicit confirmation and lifecycle order", async (t) => {
  const { root } = await fixture(t);
  await migrate(root);
  publish(root, "Migrate");
  const paths = ideaPaths(FIRST_ID);
  const idealRevision = git(root, "rev-parse", `HEAD:${paths.idealPath}`);
  const request: AppendRequest = { type: "acceptIdeal", payload: { idealRevision } };
  assert.equal(
    (await append(root, request, { confirmDecision: true })).observation.state,
    "check-unavailable",
  );
  assert.equal(
    (await append(root, {
      type: "submitIdeal",
      payload: { idealRevision: "f".repeat(40) },
    })).observation.state,
    "check-unavailable",
  );
  const submitted = await append(root, {
    type: "submitIdeal",
    payload: { idealRevision },
  });
  assert.equal(eventReceipt(submitted).outcome, "candidate-written", JSON.stringify(submitted));
  assert.equal((await append(root, request)).observation.state, "check-unavailable");
  const accepted = await append(root, request, { confirmDecision: true });
  assert.equal(eventReceipt(accepted).outcome, "candidate-written", JSON.stringify(accepted));
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
  const repairResult = validationResults(repaired)[0];
  assert.ok(repairResult);
  assert.equal(repairResult.mode, "repair");
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
  const module = new URL("../../src/business/migrate-v1-to-v2.ts", import.meta.url).href;
  const recoveryScenarios: [string, boolean][] = [
    ["prepared", false],
    [`prepared:${ideaPaths(FIRST_ID).eventsPath}`, false],
    [`applied:${ideaPaths(FIRST_ID).eventsPath}`, true],
    [`applied:${ideaPaths(FIRST_ID).statusPath}`, false],
    ["applied:.silvermoon/config.yaml", true],
    ["applied", false],
  ];
  for (const [stage, rollback] of recoveryScenarios) {
    const { root } = await fixture(t);
    const source = await readFile(join(root, ideaPaths(FIRST_ID).statusPath));
    const plan = await migrateEvents({ root });
    const digest = migrationDigest(plan);
    const child = spawnSync(process.execPath, ["--input-type=module", "-e", `
      import { migrateEvents } from ${JSON.stringify(module)};
      await migrateEvents({
        root: ${JSON.stringify(root)}, apply: true, expectedDigest: ${JSON.stringify(digest)},
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
  const cli = fileURLToPath(new URL("../../bin/silvermoon.ts", import.meta.url));
  const requests = ["en", "zh-CN"].map((language, index) => ({
    file: join(base, `request-${index}.json`),
    value: { type: "setLanguage", payload: { language } },
  }));
  await Promise.all(requests.map(({ file, value }) => writeFile(file, JSON.stringify(value))));
  const results = await Promise.all(requests.map(({ file }) => new Promise<{
    code: number | null;
    error: string;
    output: string;
  }>((done, reject) => {
    const child = spawn(process.execPath, [cli, "event", "append", FIRST_ID, "--root", root,
      "--input", file, "--expected-digest", observed.digest,
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
  const eventHistory = requiredRecord(
    requiredRecord(result.observation, "observation").eventHistory,
    "observation.eventHistory",
  );
  assert.match(requiredString(eventHistory.error, "observation.eventHistory.error"), /end with LF/);
});

test("world observation is read-only and primary movement invalidates a pending append", async (t) => {
  const { root } = await fixture(t);
  await migrate(root);
  publish(root, "Migrate");
  const paths = ideaPaths(FIRST_ID);
  const request: AppendRequest = {
    type: "acceptIdeal", payload: { idealRevision: git(root, "rev-parse", `HEAD:${paths.idealPath}`) },
  };
  await append(root, {
    type: "submitIdeal",
    payload: request.payload,
  });
  await append(root, request, { confirmDecision: true });
  publish(root, "Approve ideal");
  const before = await readFile(join(root, paths.eventsPath));
  const world = await readFile(join(root, paths.ideaDocumentPath));
  await writeFile(join(root, paths.ideaDocumentPath), "# Actually changed\n");
  const changed = await listIdeas({ root });
  const changedIdea = listedIdeas(changed)[0];
  assert.ok(changedIdea);
  assert.equal(changedIdea.state, "preparing");
  assert.deepEqual(await readFile(join(root, paths.eventsPath)), before);
  await writeFile(join(root, paths.ideaDocumentPath), world);
  const restoredIdea = listedIdeas(await listIdeas({ root }))[0];
  assert.ok(restoredIdea);
  assert.equal(restoredIdea.state, "implementing");
  const observed = await replay(root);
  await writeFile(join(root, paths.ledgerPath), "# New continuation evidence\n");
  publish(root, "Advance primary");
  const stale = await eventCommand({
    root, operation: "append", idea: FIRST_ID, input: { type: "setLanguage", payload: { language: "en" } },
    expectedDigest: observed.digest, expectedPrimary: observed.baseline.commit,
  });
  assert.equal(stale.observation.state, "check-unavailable");
  assert.match(firstProblem(stale).summary, /Primary moved/);
  assert.deepEqual(await readFile(join(root, paths.eventsPath)), before);
});

test("missing tracking refs and shallow missing parents fail closed; committed v1 history stays readable", async (t) => {
  const { root, base, remote } = await fixture(t);
  assert.ok(remote);
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

test("migration recovery refuses unknown changed bytes without overwriting them", async (t) => {
  const { root } = await fixture(t);
  const module = new URL("../../src/business/migrate-v1-to-v2.ts", import.meta.url).href;
  const plan = await migrateEvents({ root });
  const digest = migrationDigest(plan);
  const child = spawnSync(process.execPath, ["--input-type=module", "-e", `
    import { migrateEvents } from ${JSON.stringify(module)};
    await migrateEvents({ root: ${JSON.stringify(root)}, apply: true,
      expectedDigest: ${JSON.stringify(digest)},
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
    root, apply: true, expectedDigest: migrationDigest(plan),
    afterStep: async (step: string) => {
      if (step === `applied:${paths.eventsPath}`) {
        await writeFile(join(root, paths.statusPath), "Concurrent edit after preflight\n");
      }
    },
  }), /unknown content was preserved/);
  assert.equal(await readFile(join(root, paths.statusPath), "utf8"), "Concurrent edit after preflight\n");
});
