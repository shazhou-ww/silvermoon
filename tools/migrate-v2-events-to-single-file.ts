#!/usr/bin/env node
import { isDeepStrictEqual } from "node:util";
import { lstat, readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

import { Command } from "commander";

import { inspectAdoption } from "../src/foundation/skill-registration/index.ts";
import { loadConfigSnapshot } from "../src/foundation/project-config/index.ts";
import {
  localPrimary,
  SOURCE_REPOSITORY,
} from "../src/foundation/event-history/index.ts";
import {
  gitContentDigest,
  validateEventRecordSizes,
} from "../src/foundation/event-store/index.ts";
import { parseIdeaEvents, replayIdeaEvents } from "../src/foundation/event-codec/index.ts";
import { inspectIdeaLayout } from "../src/business/shared/index.ts";
import {
  fetchPrimary,
  inspectRepositoryState,
  inspectTreePaths,
  inspectTreeLineage,
  worktreeSnapshot,
} from "../src/foundation/git/index.ts";
import { IDEAS_ROOT, ideaPaths } from "../src/foundation/coordinates/index.ts";
import {
  digest,
  recoverStateTransaction,
  stateTransaction,
} from "../src/foundation/state-transaction/index.ts";

interface MigrationOptions {
  root?: string;
  apply?: boolean;
  expectedDigest?: string;
  resume?: boolean;
  rollback?: boolean;
  confirmStopped?: boolean;
  afterStep?: (step: string) => void | Promise<void>;
}

interface WorldSnapshot {
  id: string;
  revisions: {
    idealRevision: string;
    implementationRevision: string;
    deploymentRevision: string;
  };
}

async function validateWorlds(
  root: string,
  config: NonNullable<Awaited<ReturnType<typeof inspectAdoption>>["config"]>,
  expected: unknown,
) {
  const current = await inspectIdeaLayout({ root, config });
  if (!Array.isArray(expected)
    || current.diagnostics.length
    || current.ideas.length !== expected.length
    || expected.some((candidate: unknown) => {
      if (candidate === null || typeof candidate !== "object"
        || !("id" in candidate) || typeof candidate.id !== "string"
        || !("revisions" in candidate) || candidate.revisions === null
        || typeof candidate.revisions !== "object") return true;
      const next = current.ideas.find((idea) => idea.id === candidate.id);
      return !next || !isDeepStrictEqual(next.revisions, candidate.revisions);
    })) {
    throw new Error("Source inventory or worlds changed during migration; preserve unknown work.");
  }
}

async function requireSourceCheckout(root: string) {
  const manifest: unknown = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
  if (manifest === null || typeof manifest !== "object"
    || !("name" in manifest) || manifest.name !== "silvermoon"
    || !("repository" in manifest) || manifest.repository === null
    || typeof manifest.repository !== "object"
    || !("url" in manifest.repository)
    || manifest.repository.url !== `git+${SOURCE_REPOSITORY}`) {
    throw new Error(
      "Single-file V2 migration is restricted to the unpublished Silvermoon source checkout.",
    );
  }
}

const EVENTS_PER_SEGMENT = 1000;

function segmentedPaths(id: string) {
  const current = ideaPaths(id);
  return {
    ...current,
    eventsDirectory: `${current.ideaPath}/events`,
  };
}

async function metadata(path: string) {
  try {
    return await lstat(path);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }
}

async function readMigrationSource(
  root: string,
  id: string,
  objectIdLength: number,
) {
  const paths = segmentedPaths(id);
  const fileInfo = await metadata(resolve(root, paths.eventsPath));
  const directoryInfo = await metadata(resolve(root, paths.eventsDirectory));
  if (fileInfo && directoryInfo) {
    throw new Error(`${id}: single-file and segmented authorities cannot coexist`);
  }
  if (fileInfo) {
    if (!fileInfo.isFile() || fileInfo.isSymbolicLink()) {
      throw new Error(`${id}: irregular events.jsonl authority`);
    }
    const bytes = await readFile(resolve(root, paths.eventsPath));
    validateEventRecordSizes(bytes);
    return {
      storage: "single-file" as const,
      paths,
      bytes,
      length: bytes.length,
      entries: [],
      digest: gitContentDigest("blob", bytes, { objectIdLength }),
    };
  }
  if (!directoryInfo?.isDirectory() || directoryInfo.isSymbolicLink()) {
    throw new Error(`${id}: missing regular segmented event source`);
  }
  const names = (await readdir(resolve(root, paths.eventsDirectory))).sort();
  if (!names.length) throw new Error(`${id}: segmented source has no identity segment`);
  const entries: { name: string; bytes: Buffer; object: string }[] = [];
  for (let index = 0; index < names.length; index++) {
    const expected = `${String(index + 1).padStart(16, "0")}.jsonl`;
    const name = names[index];
    if (name !== expected) {
      throw new Error(`${id}: unexpected or noncanonical segmented entry ${String(name)}`);
    }
    const path = resolve(root, paths.eventsDirectory, name);
    const info = await lstat(path);
    if (!info.isFile() || info.isSymbolicLink()) {
      throw new Error(`${id}: irregular segmented entry ${name}`);
    }
    const bytes = await readFile(path);
    validateEventRecordSizes(bytes);
    const events = parseIdeaEvents(bytes, { objectIdLength });
    if (events.length > EVENTS_PER_SEGMENT
      || (index < names.length - 1 && events.length !== EVENTS_PER_SEGMENT)
      || (!events.length && names.length !== 1)) {
      throw new Error(`${id}: invalid segmented record count at ${name}`);
    }
    entries.push({
      name,
      bytes,
      object: gitContentDigest("blob", bytes, { objectIdLength }),
    });
  }
  const treeBytes = Buffer.concat(entries.map(({ name, object }) => Buffer.concat([
    Buffer.from(`100644 ${name}\0`),
    Buffer.from(object, "hex"),
  ])));
  return {
    storage: "segmented" as const,
    paths,
    entries,
    bytes: Buffer.concat(entries.map(({ bytes }) => bytes)),
    length: entries.reduce((total, entry) => total + entry.bytes.length, 0),
    digest: gitContentDigest("tree", treeBytes, { objectIdLength }),
  };
}

function worldSnapshots(root: string, tree: string, ids: string[]): WorldSnapshot[] {
  const paths = ids.flatMap((id) => {
    const current = ideaPaths(id);
    return [current.idealPath, current.innerPath, current.outerPath];
  });
  const objects = inspectTreePaths(root, tree, paths);
  return ids.map((id) => {
    const current = ideaPaths(id);
    const required = (path: string) => {
      const entry = objects.get(path);
      if (!entry || entry.type !== "tree" || entry.object === null) {
        throw new Error(`${id}: required world tree is unavailable at ${path}`);
      }
      return entry.object;
    };
    return {
      id,
      revisions: {
        idealRevision: required(current.idealPath),
        implementationRevision: required(current.innerPath),
        deploymentRevision: required(current.outerPath),
      },
    };
  });
}

export async function migrateV2EventsToSingleFile({
  root = process.cwd(),
  apply = false,
  expectedDigest,
  resume = false,
  rollback = false,
  confirmStopped = false,
  afterStep,
}: MigrationOptions = {}) {
  root = resolve(root);
  const adoption = await inspectAdoption({ root });
  const blockers = adoption.findings.filter((finding) => {
    const sourceDiagnostic: unknown = "sourceDiagnostic" in finding
      ? finding.sourceDiagnostic
      : undefined;
    return !((resume || rollback)
      && sourceDiagnostic !== null
      && typeof sourceDiagnostic === "object"
      && "message" in sourceDiagnostic
      && typeof sourceDiagnostic.message === "string"
      && sourceDiagnostic.message.includes("Unfinished state transaction"));
  });
  if (blockers.length) {
    throw new Error(blockers.flatMap(({ problem }) =>
      problem === undefined ? [] : [problem.summary]).join("; "));
  }
  root = adoption.root;
  await requireSourceCheckout(root);
  if (resume || rollback) {
    const validate: NonNullable<
      NonNullable<Parameters<typeof recoverStateTransaction>[1]>["validate"]
    > = async (plan) => {
      if (plan.context === null || typeof plan.context !== "object"
        || !("migration" in plan.context)
        || plan.context.migration !== "segmented-v2-to-single-file"
        || !("sourceCommit" in plan.context)
        || typeof plan.context.sourceCommit !== "string"
        || inspectRepositoryState(root).head !== plan.context.sourceCommit) {
        throw new Error(
          "Single-file migration source or transaction identity changed; preserve the plan.",
        );
      }
      if (!rollback) {
        const loaded = await loadConfigSnapshot({
          gitRoot: root,
          tree: plan.context.sourceCommit,
        });
        if (!loaded.config
          || !("primary" in plan.context)
          || typeof plan.context.primary !== "string"
          || fetchPrimary(root, loaded.config) !== plan.context.primary) {
          throw new Error(
            "Primary moved; roll back owned bytes and reobserve instead of replaying this migration.",
          );
        }
      }
    };
    return recoverStateTransaction(root, {
      rollback,
      confirmedStopped: confirmStopped,
      kind: "migration",
      validate,
      validateRollback: validate,
      validateApplied: async (plan) => {
        await validate(plan);
        if (plan.context === null || typeof plan.context !== "object"
          || !("sourceCommit" in plan.context)
          || typeof plan.context.sourceCommit !== "string"
          || !("worlds" in plan.context)) {
          throw new Error("Migration recovery is missing its validated world snapshot.");
        }
        const loaded = await loadConfigSnapshot({
          gitRoot: root,
          tree: plan.context.sourceCommit,
        });
        if (!loaded.config) {
          throw new Error("Migration recovery cannot load its source configuration.");
        }
        await validateWorlds(root, loaded.config, plan.context.worlds);
      },
    });
  }
  const config = adoption.config;
  if (config?.version !== 2 || config.primaryRepository !== SOURCE_REPOSITORY) {
    throw new Error(
      "Single-file V2 migration is restricted to the unpublished Silvermoon source checkout.",
    );
  }
  const repository = inspectRepositoryState(root);
  const { tree } = worktreeSnapshot(root);
  const primary = localPrimary(root, config).commit;
  const ids = inspectTreeLineage(root, tree, IDEAS_ROOT)
    .filter(({ type, name }) => type === "tree" && name.split("/").length === 3)
    .map(({ name }) => name.split("/")[2])
    .filter((id): id is string => id !== undefined)
    .sort();
  const options = { objectIdLength: tree.length };
  const worlds = worldSnapshots(root, tree, ids);
  const files: { path: string; before: Buffer | null; after: Buffer | null }[] = [];
  const removeDirectories: string[] = [];
  const ideas: {
    id: string;
    sourceDigest: string;
    candidateDigest: string;
    length: number;
    sequence: number;
  }[] = [];
  let singleFile = 0;
  for (const id of ids) {
    const store = await readMigrationSource(root, id, tree.length);
    const { paths } = store;
    const result = replayIdeaEvents(id, parseIdeaEvents(store.bytes, options), options);
    if (!result.ok || !("state" in result)) {
      throw new Error(
        `${id}: invalid source reduction ${"code" in result ? result.code : "missing-state"}`,
      );
    }
    if (store.storage === "single-file") {
      singleFile++;
      continue;
    }
    const candidateDigest = gitContentDigest("blob", store.bytes, options);
    files.push({
      path: paths.eventsPath,
      before: null,
      after: store.bytes,
    }, ...store.entries.map(({ name, bytes }) => ({
      path: `${paths.eventsDirectory}/${name}`,
      before: bytes,
      after: null,
    })));
    removeDirectories.push(paths.eventsDirectory);
    ideas.push({
      id,
      sourceDigest: store.digest,
      candidateDigest,
      length: store.length,
      sequence: result.state.sequence,
    });
  }
  if (singleFile === ids.length) {
    return {
      outcome: "already-single-file",
      written: false,
      primary,
      ideas: ids,
    };
  }
  if (singleFile > 0) {
    throw new Error(
      "Mixed V2 event storage; migrate every source idea together without changing inventory.",
    );
  }
  const fingerprint = digest(JSON.stringify({
    sourceCommit: repository.head,
    primary,
    removeDirectories,
    files: files.map(({ path, before, after }) => ({
      path,
      before: before === null ? null : digest(before),
      after: after === null ? null : digest(after),
    })),
  }));
  const receipt = {
    outcome: "migration-planned",
    written: false,
    digest: fingerprint,
    sourceCommit: repository.head,
    primary,
    ideas,
  };
  if (!apply) return receipt;
  if (fingerprint !== expectedDigest) {
    throw new Error("Migration plan changed; confirm the exact current digest.");
  }
  if (fetchPrimary(root, config) !== primary
    || repository.head !== primary
    || inspectRepositoryState(root).head !== repository.head) {
    throw new Error("Migration requires its exact clean source commit on fetched primary.");
  }
  if ([
    repository.changes.conflicted,
    repository.changes.staged,
    repository.changes.unstaged,
    repository.changes.untracked,
  ].some((changes) => changes.length > 0)) {
    throw new Error("Migration requires a clean committed worktree; preserve every local change.");
  }
  await stateTransaction(root, "migration", files, {
    removeDirectories,
    ...(afterStep === undefined ? {} : { afterStep }),
    context: {
      migration: "segmented-v2-to-single-file",
      sourceCommit: repository.head,
      primary,
      worlds,
    },
    validate: () => {
      if (inspectRepositoryState(root).head !== repository.head
        || fetchPrimary(root, config) !== primary) {
        throw new Error(
          "Source or primary moved before migration; recover the unwritten transaction.",
        );
      }
    },
    validateApplied: async () => {
      if (inspectRepositoryState(root).head !== repository.head
        || fetchPrimary(root, config) !== primary) {
        throw new Error("Source or primary moved during migration; preserve the transaction.");
      }
      await validateWorlds(root, config, worlds);
    },
  });
  return { ...receipt, outcome: "migrated", written: true };
}

const invokedPath = process.argv[1] === undefined ? null : resolve(process.argv[1]);
if (invokedPath === fileURLToPath(import.meta.url)) {
  const program = new Command()
    .name("migrate-v2-events-to-single-file")
    .description("One-time unpublished V2 event layout migration; defaults to a read-only plan")
    .option("--root <path>", "project root", process.cwd())
    .option("--apply", "apply the exact confirmed plan")
    .option("--expected-digest <sha256>", "digest returned by the read-only plan")
    .option("--resume", "complete an interrupted migration")
    .option("--rollback", "restore an interrupted migration's original files")
    .option("--confirm-stopped", "confirm the interrupted writer has stopped");
  try {
    program.parse();
    const options = program.opts<{
      root: string;
      apply?: boolean;
      expectedDigest?: string;
      resume?: boolean;
      rollback?: boolean;
      confirmStopped?: boolean;
    }>();
    if ([options.apply, options.resume, options.rollback].filter(Boolean).length > 1) {
      throw new Error("Choose only one of --apply, --resume or --rollback.");
    }
    console.log(JSON.stringify(await migrateV2EventsToSingleFile(options), null, 2));
  } catch (error) {
    console.error(
      `ERROR migration.failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}
