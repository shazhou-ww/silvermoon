import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, lstat, mkdir, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import { migrateEvents } from "../../src/business/migrate-v1-to-v2.ts";
import { serializeIdeaEvents } from "../../src/foundation/event-codec/index.ts";
import { ideaPaths } from "../../src/foundation/coordinates/index.ts";
import { readEventStorage } from "../../src/foundation/event-store/index.ts";
import { createRepository, FIRST_ID, git } from "../helpers/repository.ts";

const SOURCE_REPOSITORY = "https://github.com/shazhou-ww/silvermoon.git";
const sourceRoot = fileURLToPath(new URL("../..", import.meta.url));
type CheckRepository = typeof import("../../src/index.ts").checkRepository;

function requiredDigest(result: Awaited<ReturnType<typeof migrateEvents>>) {
  assert.equal(result.outcome, "migration-planned");
  assert.ok("digest" in result);
  return result.digest;
}

async function readSegmentedBytes(root: string, eventsDirectory: string) {
  const names = (await readdir(join(root, eventsDirectory))).sort();
  return Buffer.concat(await Promise.all(
    names.map((name) => readFile(join(root, eventsDirectory, name))),
  ));
}

async function fixture(t: test.TestContext) {
  const repository = await createRepository();
  t.after(() => rm(repository.base, { recursive: true, force: true }));
  const { root, remote } = repository;
  assert.ok(remote);
  const v2Plan = await migrateEvents({ root });
  await migrateEvents({
    root,
    apply: true,
    expectedDigest: requiredDigest(v2Plan),
  });
  const paths = ideaPaths(FIRST_ID);
  const events = [
    { sequence: 1, type: "setAlias", payload: { alias: "fixture" } },
    ...Array.from({ length: 1000 }, (_, index) => ({
      sequence: index + 2,
      type: "pong",
      payload: { message: `event ${index}` },
    })),
  ];
  const source = Buffer.from(serializeIdeaEvents(events));
  const eventsDirectory = `${paths.ideaPath}/events`;
  await rm(join(root, paths.eventsPath));
  await mkdir(join(root, eventsDirectory));
  for (let index = 0; index < events.length; index += 1000) {
    const name = `${String(index / 1000 + 1).padStart(16, "0")}.jsonl`;
    await writeFile(
      join(root, eventsDirectory, name),
      serializeIdeaEvents(events.slice(index, index + 1000)),
    );
  }
  for (const path of ["src", "bin", "tools", "skills", "package.json"]) {
    await cp(join(sourceRoot, path), join(root, path), { recursive: true });
  }
  await symlink(join(sourceRoot, "node_modules"), join(root, "node_modules"), "dir");
  await writeFile(join(root, ".gitignore"), "node_modules/\n");
  await writeFile(
    join(root, ".silvermoon", "config.yaml"),
    [
      "version: 2",
      `primaryRepository: ${SOURCE_REPOSITORY}`,
      "primaryBranch: main",
      "",
    ].join("\n"),
  );
  const repositoryUrl = pathToFileURL(remote).href;
  git(root, "config", `url.${repositoryUrl}.insteadOf`, SOURCE_REPOSITORY);
  git(root, "remote", "set-url", "origin", SOURCE_REPOSITORY);
  git(root, "add", ".");
  git(root, "commit", "-m", "Prepare unpublished segmented V2 source");
  git(root, "push", "origin", "HEAD:main");
  const module = pathToFileURL(
    join(root, "tools", "migrate-v2-events-to-single-file.ts"),
  ).href;
  const migration: typeof import("../../tools/migrate-v2-events-to-single-file.ts") =
    await import(module);
  const runtime: typeof import("../../src/index.ts") = await import(
    pathToFileURL(join(root, "src", "index.ts")).href
  );
  return {
    ...repository,
    paths: { ...paths, eventsDirectory },
    source,
    module,
    checkRepository: runtime.checkRepository,
    migrateV2EventsToSingleFile: migration.migrateV2EventsToSingleFile,
  };
}

function validationResults(report: Awaited<ReturnType<CheckRepository>>) {
  assert.equal(report.observation.state, "project-ready", JSON.stringify(report.observation));
  const response: unknown = report.response;
  assert.ok(response !== null && typeof response === "object" && "validation" in response);
  const validation = response.validation;
  assert.ok(validation !== null && typeof validation === "object"
    && "eventHistory" in validation);
  const eventHistory = validation.eventHistory;
  assert.ok(eventHistory !== null && typeof eventHistory === "object"
    && "results" in eventHistory && Array.isArray(eventHistory.results));
  return eventHistory.results;
}

test("one-time migration preserves exact V2 bytes without changing the schema version", async (t) => {
  const {
    root,
    paths,
    source,
    checkRepository,
    migrateV2EventsToSingleFile,
  } = await fixture(t);
  const plan = await migrateV2EventsToSingleFile({ root });
  assert.equal(plan.outcome, "migration-planned");
  assert.ok("digest" in plan);
  await assert.rejects(
    migrateV2EventsToSingleFile({
      root,
      apply: true,
      expectedDigest: "0".repeat(64),
    }),
    /plan changed/,
  );
  const migrated = await migrateV2EventsToSingleFile({
    root,
    apply: true,
    expectedDigest: plan.digest,
  });
  assert.equal(migrated.outcome, "migrated");
  assert.deepEqual(await readFile(join(root, paths.eventsPath)), source);
  await assert.rejects(lstat(join(root, paths.eventsDirectory)), /ENOENT/);
  assert.match(
    await readFile(join(root, ".silvermoon", "config.yaml"), "utf8"),
    /^version: 2$/m,
  );
  const store = await readEventStorage(
    root,
    paths,
    { objectIdLength: 40 },
  );
  assert.equal(store.storage, "single-file");
  assert.deepEqual(store.bytes, source);
  git(root, "add", ".");
  git(root, "commit", "-m", "Migrate V2 events to one file");
  git(root, "push", "origin", "HEAD:main");
  validationResults(await checkRepository({ root, worktree: true }));
  assert.equal(
    (await migrateV2EventsToSingleFile({ root })).outcome,
    "already-single-file",
  );
});

test("one-time migration preserves dirty work and exact source bytes", async (t) => {
  const { root, paths, source, migrateV2EventsToSingleFile } = await fixture(t);
  const plan = await migrateV2EventsToSingleFile({ root });
  assert.ok("digest" in plan);
  await writeFile(join(root, "unknown.txt"), "preserve\n");
  await assert.rejects(
    migrateV2EventsToSingleFile({
      root,
      apply: true,
      expectedDigest: plan.digest,
    }),
    /clean committed/,
  );
  assert.equal(await readFile(join(root, "unknown.txt"), "utf8"), "preserve\n");
  assert.deepEqual(await readSegmentedBytes(root, paths.eventsDirectory), source);
});

test("interrupted single-file migration resumes or rolls back exact owned paths", async (t) => {
  for (const rollback of [false, true]) {
    const {
      root,
      paths,
      source,
      module,
      migrateV2EventsToSingleFile,
    } = await fixture(t);
    const plan = await migrateV2EventsToSingleFile({ root });
    assert.ok("digest" in plan);
    const child = spawnSync(process.execPath, ["--input-type=module", "-e", `
      import { migrateV2EventsToSingleFile } from ${JSON.stringify(module)};
      await migrateV2EventsToSingleFile({
        root: ${JSON.stringify(root)},
        apply: true,
        expectedDigest: ${JSON.stringify(plan.digest)},
        afterStep: (step) => {
          if (step === ${JSON.stringify(`applied:${paths.eventsPath}`)}) process.exit(77);
        },
      });
    `], { encoding: "utf8", windowsHide: true });
    assert.equal(child.status, 77, child.stderr);
    const result = await migrateV2EventsToSingleFile({
      root,
      resume: !rollback,
      rollback,
      confirmStopped: true,
    });
    assert.equal(result.outcome, rollback ? "rolled-back" : "recovered");
    if (rollback) {
      assert.deepEqual(await readSegmentedBytes(root, paths.eventsDirectory), source);
    } else {
      const store = await readEventStorage(
        root,
        paths,
        { objectIdLength: 40 },
      );
      assert.equal(store.storage, "single-file");
      assert.deepEqual(store.bytes, source);
    }
  }
});
