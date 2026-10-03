import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import { readEventStorage } from "../../src/events/storage.js";
import { serializeIdeaEvents } from "../../src/events/rules/grammar.js";
import { ideaPaths } from "../../src/project/rules/layout.js";
import { createRepository, FIRST_ID, git } from "../helpers/repository.js";

const SOURCE = "https://github.com/shazhou-ww/silvermoon.git";
const sourceRoot = fileURLToPath(new URL("../..", import.meta.url));

async function fixture(t) {
  const repository = await createRepository();
  t.after(() => rm(repository.base, { recursive: true, force: true }));
  const { root, remote } = repository;
  git(root, "config", `url.file://${remote}.insteadOf`, SOURCE);
  git(root, "remote", "set-url", "origin", SOURCE);
  for (const path of ["src", "bin", "skills", "package.json"]) {
    await cp(join(sourceRoot, path), join(root, path), { recursive: true });
  }
  await symlink(join(sourceRoot, "node_modules"), join(root, "node_modules"), "dir");
  await writeFile(join(root, ".gitignore"), "node_modules/\n");
  await writeFile(join(root, ".silvermoon/config.yaml"),
    `version: 2\nprimaryRepository: ${SOURCE}\nprimaryBranch: main\n`);
  const paths = ideaPaths(FIRST_ID);
  await rm(join(root, paths.statusPath));
  const source = Buffer.from(serializeIdeaEvents([
    { sequence: 1, type: "setAlias", payload: { alias: "fixture" } },
    { sequence: 2, type: "acceptIdeal", payload: {
      idealRevision: git(root, "rev-parse", `HEAD:${paths.idealPath}`),
    } },
    ...Array.from({ length: 1999 }, (_, index) => ({
      sequence: index + 3, type: "pong", payload: { message: `事件 ${index}` },
    })),
  ]));
  await writeFile(join(root, paths.legacyEventsPath), source);
  git(root, "add", ".");
  git(root, "commit", "-m", "Unpublished source V2 fixture");
  git(root, "push", "origin", "HEAD:main");
  const { migrateSegmentedEvents } = await import(pathToFileURL(join(root, "src/application/migrations/segmented-events.js")));
  const { checkRepository } = await import(pathToFileURL(join(root, "src/index.js")));
  return { ...repository, source, paths, migrateSegmentedEvents, checkRepository };
}

test("internal segmentation preserves exact records and decisions, and has a protected history boundary", async (t) => {
  const { root, source, paths, migrateSegmentedEvents, checkRepository } = await fixture(t);
  const plan = await migrateSegmentedEvents({ root });
  assert.equal(plan.outcome, "migration-planned");
  assert.deepEqual(await readFile(join(root, paths.legacyEventsPath)), source);
  await assert.rejects(migrateSegmentedEvents({ root, apply: true, expectedDigest: "0".repeat(64) }), /plan changed/);
  assert.equal((await migrateSegmentedEvents({ root, apply: true, expectedDigest: plan.digest })).outcome, "migrated");
  const store = await readEventStorage(root, paths, { objectIdLength: 40 });
  assert.equal(store.entries.length, 3);
  assert.deepEqual(store.bytes, source);
  const checked = await checkRepository({ root, worktree: true });
  assert.equal(checked.observation.state, "project-ready", JSON.stringify(checked.observation));
  assert.equal(checked.response.validation.eventHistory.results[0].mode, "migration-segmented");
  git(root, "add", ".");
  git(root, "commit", "-m", "Segment all source ideas");
  git(root, "push", "origin", "HEAD:main");
  assert.equal((await migrateSegmentedEvents({ root })).outcome, "already-segmented");
  await writeFile(join(root, paths.eventsPath), "");
  assert.equal((await checkRepository({ root, worktree: true })).observation.state, "check-unavailable");
});

test("migration refuses dirty or changed sources and non-source repositories", async (t) => {
  const { root, migrateSegmentedEvents } = await fixture(t);
  const plan = await migrateSegmentedEvents({ root });
  await writeFile(join(root, "unknown.txt"), "preserve\n");
  await assert.rejects(migrateSegmentedEvents({ root, apply: true, expectedDigest: plan.digest }), /clean committed/);
  assert.equal(await readFile(join(root, "unknown.txt"), "utf8"), "preserve\n");
  await writeFile(join(root, "package.json"), JSON.stringify({ name: "consumer" }));
  await assert.rejects(migrateSegmentedEvents({ root }), /devDependencies\.silvermoon/);
});

test("migration preserves concurrent world edits and leaves an explicit recovery barrier", async (t) => {
  const { root, paths, migrateSegmentedEvents } = await fixture(t);
  const plan = await migrateSegmentedEvents({ root });
  const path = join(root, paths.ideaDocumentPath);
  const original = await readFile(path, "utf8");
  const changed = `${original}\nConcurrent world edit\n`;
  await assert.rejects(migrateSegmentedEvents({
    root, apply: true, expectedDigest: plan.digest,
    afterStep: async (step) => {
      if (step === `applied:${paths.eventsPath}`) await writeFile(path, changed);
    },
  }), /inventory or worlds changed/);
  assert.equal(await readFile(path, "utf8"), changed);
  assert.equal(JSON.parse(await readFile(join(root, ".silvermoon/transaction"), "utf8")).kind, "migration");
});

test("interrupted segmentation resumes or rolls back only exact operation-owned files", async (t) => {
  for (const rollback of [false, true]) {
    const { root, source, paths, migrateSegmentedEvents } = await fixture(t);
    const module = pathToFileURL(join(root, "src/application/migrations/segmented-events.js")).href;
    const plan = await migrateSegmentedEvents({ root });
    const child = spawnSync(process.execPath, ["--input-type=module", "-e", `
      import { migrateSegmentedEvents } from ${JSON.stringify(module)};
      await migrateSegmentedEvents({
        root: ${JSON.stringify(root)}, apply: true, expectedDigest: ${JSON.stringify(plan.digest)},
        afterStep: (step) => { if (step === ${JSON.stringify(`applied:${paths.eventsPath}`)}) process.exit(77); }
      });
    `], { encoding: "utf8" });
    assert.equal(child.status, 77, child.stderr);
    const result = await migrateSegmentedEvents({ root, resume: !rollback, rollback, confirmStopped: true });
    assert.equal(result.outcome, rollback ? "rolled-back" : "recovered");
    if (rollback) assert.deepEqual(await readFile(join(root, paths.legacyEventsPath)), source);
    else assert.deepEqual((await readEventStorage(root, paths, { objectIdLength: 40 })).bytes, source);
  }
});
