import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { inspectAdoption } from "../../project/index.js";
import { loadConfigSnapshot } from "../../project/index.js";
import { inspectEventHistory, localPrimary, SOURCE_REPOSITORY } from "../../events/index.js";
import { readEventStorage } from "../../events/index.js";
import { EventStream } from "../../events/index.js";
import { inspectIdeaLayout } from "../observation/index.js";
import { replayIdeaEvents, parseIdeaEvents } from "../../events/rules/index.js";
import { fetchPrimary, inspectRepositoryState, inspectTreeLineage, worktreeSnapshot } from "../../repository/index.js";
import { IDEAS_ROOT, ideaPaths } from "../../project/rules/index.js";
import { digest, recoverStateTransaction, stateTransaction } from "../../repository/index.js";

async function validateWorlds(root, config, expected) {
  const current = await inspectIdeaLayout({ root, config });
  if (!Array.isArray(expected) || current.diagnostics.length || current.ideas.length !== expected.length
    || expected.some(({ id, revisions }) => {
      const next = current.ideas.find((idea) => idea.id === id);
      return !next || Object.keys(revisions).some((key) => next.revisions[key] !== revisions[key]);
    })) {
    throw new Error("Source inventory or worlds changed during segmentation; preserve unknown work.");
  }
}

export async function migrateSegmentedEvents({
  root = process.cwd(), apply = false, expectedDigest,
  resume = false, rollback = false, confirmStopped = false, afterStep,
} = {}) {
  root = resolve(root);
  const adoption = await inspectAdoption({ root });
  const blockers = adoption.findings.filter(({ sourceDiagnostic }) =>
    !((resume || rollback) && sourceDiagnostic?.message.includes("Unfinished state transaction")));
  if (blockers.length) throw new Error(blockers.map(({ problem }) => problem.summary).join("; "));
  root = adoption.root;
  const config = resume || rollback
    ? (await loadConfigSnapshot({ gitRoot: root, tree: "HEAD" })).config
    : adoption.config;
  const manifest = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
  if (config?.version !== 2 || config.primaryRepository !== SOURCE_REPOSITORY
    || manifest.name !== "silvermoon" || manifest.repository?.url !== `git+${SOURCE_REPOSITORY}`) {
    throw new Error("Segmentation migration is restricted to the unpublished V2 Silvermoon source checkout.");
  }
  if (resume || rollback) {
    const validate = async (plan) => {
      if (plan.context?.migration !== "single-file-to-segmented"
        || inspectRepositoryState(root).head !== plan.context.sourceCommit) {
        throw new Error("Segmentation migration source or transaction identity changed; preserve the plan.");
      }
      if (!rollback) {
        const loaded = await loadConfigSnapshot({ gitRoot: root, tree: plan.context.sourceCommit });
        if (!loaded.config || fetchPrimary(root, loaded.config) !== plan.context.primary) {
          throw new Error("Primary moved; roll back owned bytes and reobserve instead of replaying this migration.");
        }
      }
    };
    return recoverStateTransaction(root, {
      rollback, confirmedStopped: confirmStopped, kind: "migration",
      validate, validateRollback: validate,
      validateApplied: (plan) => validateWorlds(root, config, plan.context.worlds),
    });
  }
  const primary = localPrimary(root, config).commit;
  const repository = inspectRepositoryState(root);
  const { tree } = worktreeSnapshot(root);
  await inspectEventHistory({ root, tree, config, primary });
  const layout = await inspectIdeaLayout({ root, config, snapshotTree: tree });
  if (layout.diagnostics.length) throw new Error(layout.diagnostics.map((item) => item.message).join("; "));
  const ids = inspectTreeLineage(root, tree, IDEAS_ROOT)
    .filter(({ type, name }) => type === "tree" && name.split("/").length === 3)
    .map(({ name }) => name.split("/")[2]).sort();
  const options = { objectIdLength: tree.length, allowSingleFile: true };
  const files = [];
  const directories = [];
  let segmented = 0;
  const heads = [];
  for (const id of ids) {
    const paths = ideaPaths(id);
    const store = await readEventStorage(root, paths, options);
    const events = parseIdeaEvents(store.bytes, options);
    const result = replayIdeaEvents(id, events, options);
    if (!result.ok) throw new Error(`${id}: invalid source reduction ${result.code}`);
    if (store.storage === "segmented") { segmented++; continue; }
    const candidate = EventStream.fromBytes(store.bytes, options);
    if (!candidate.bytes().equals(store.bytes)) throw new Error(`${id}: segmentation changed source bytes.`);
    heads.push({ id, digest: candidate.digest, length: candidate.length, count: candidate.count });
    directories.push(paths.eventsDirectory);
    files.push(...candidate.entries().map(({ name, bytes }) => ({
      path: `${paths.eventsDirectory}/${name}`, before: null, after: bytes,
    })), { path: paths.legacyEventsPath, before: store.bytes, after: null });
  }
  if (segmented === ids.length) return { outcome: "already-segmented", written: false, primary };
  if (segmented) throw new Error("Mixed event storage; migrate every source idea together without changing inventory.");
  const fingerprint = digest(JSON.stringify({
    sourceCommit: repository.head, primary, directories,
    files: files.map(({ path, before, after }) => ({
      path, before: before === null ? null : digest(before), after: after === null ? null : digest(after),
    })),
  }));
  const receipt = { outcome: "migration-planned", written: false, digest: fingerprint,
    sourceCommit: repository.head, primary, ideas: heads };
  if (!apply) return receipt;
  if (fingerprint !== expectedDigest) throw new Error("Migration plan changed; confirm the exact current digest.");
  if (fetchPrimary(root, config) !== primary || repository.head !== primary) {
    throw new Error("Migration requires its exact clean source commit on fetched primary.");
  }
  if (["conflicted", "staged", "unstaged", "untracked"].some((key) => repository.changes[key].length)) {
    throw new Error("Migration requires a clean committed worktree; preserve every local change.");
  }
  await stateTransaction(root, "migration", files, {
    directories, afterStep,
    context: {
      migration: "single-file-to-segmented", sourceCommit: repository.head, primary,
      worlds: layout.ideas.map(({ id, revisions }) => ({ id, revisions })),
    },
    validate: () => {
      if (inspectRepositoryState(root).head !== repository.head || fetchPrimary(root, config) !== primary) {
        throw new Error("Source or primary moved before segmentation; recover the unwritten transaction.");
      }
    },
    validateApplied: async () => {
      if (fetchPrimary(root, config) !== primary || inspectRepositoryState(root).head !== repository.head) {
        throw new Error("Source or primary moved during segmentation; preserve the transaction.");
      }
      await validateWorlds(root, config, layout.ideas);
    },
  });
  return { ...receipt, outcome: "migrated", written: true };
}
