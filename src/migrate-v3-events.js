import { resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";

import { inspectAdoption } from "./adoption.js";
import { loadConfigSnapshot, serializeConfig } from "./config.js";
import { parseIdeaEvents, renameV2Events, replayIdeaEvents, serializeIdeaEvents } from "./idea-events.js";
import { inspectIdeaLayout } from "./idea-layout.js";
import { inspectEventHistory, localPrimary } from "./event-history.js";
import { fetchPrimary, inspectRepositoryState, worktreeSnapshot } from "./git.js";
import { CONFIG_PATH, ideaPaths } from "./layout.js";
import { digest, recoverStateTransaction, regularBytes, stateTransaction } from "./state-transaction.js";

export async function migrateV2ToV3({
  root = process.cwd(), apply = false, expectedDigest,
  resume = false, rollback = false, confirmStopped = false, afterStep,
} = {}) {
  root = resolve(root);
  const adoption = await inspectAdoption({ root });
  const blockers = adoption.findings.filter(({ sourceDiagnostic }) =>
    !((resume || rollback) && sourceDiagnostic?.message.includes("Unfinished state transaction")));
  if (blockers.length) throw new Error(blockers.map(({ problem }) => problem.summary).join("; "));
  root = adoption.root;
  if (resume || rollback) {
    const validate = async (plan) => {
      if (plan.context?.fromVersion !== 2 || plan.context?.toVersion !== 3) {
        throw new Error("Transaction is not a v2-to-v3 migration; preserve its original recovery plan.");
      }
      if (inspectRepositoryState(root).head !== plan.context.sourceCommit) {
        throw new Error("Migration source commit changed; preserve the transaction rather than discarding potentially integrated facts.");
      }
      if (!rollback) {
        const original = await loadConfigSnapshot({
          gitRoot: root, tree: plan.context.sourceCommit,
        });
        if (!original.config || fetchPrimary(root, original.config) !== plan.context.primary) {
          throw new Error("Primary moved; roll back and reobserve the migration.");
        }
      }
    };
    return recoverStateTransaction(root, {
      rollback, confirmedStopped: confirmStopped, kind: "migration", validate, validateRollback: validate,
    });
  }
  const config = adoption.config;
  if (config.version === 3) return { outcome: "already-v3", written: false };
  if (config.version !== 2) throw new Error("The v2-to-v3 migration requires a v2 event project.");
  const primary = localPrimary(root, config).commit;
  const { tree } = worktreeSnapshot(root);
  await inspectEventHistory({ root, tree, config, primary });
  const layout = await inspectIdeaLayout({ root, config, snapshotTree: tree });
  if (layout.diagnostics.length) throw new Error(layout.diagnostics.map((d) => d.message).join("; "));
  const options = { objectIdLength: tree.length };
  const files = [];
  for (const idea of layout.ideas) {
    const path = ideaPaths(idea.id).eventsPath;
    const before = await regularBytes(resolve(root, path));
    if (before === null) throw new Error(`Missing migration source: ${path}`);
    const oldEvents = parseIdeaEvents(before, options);
    const oldResult = replayIdeaEvents(idea.id, oldEvents, options);
    if (!oldResult.ok) throw new Error(`${idea.id}: invalid v2 event ${oldResult.sequence}: ${oldResult.code}`);
    const converted = renameV2Events(oldEvents);
    const v3 = { ...options, version: 3 };
    const after = Buffer.from(serializeIdeaEvents(converted, v3));
    const newResult = replayIdeaEvents(idea.id, parseIdeaEvents(after, v3), v3);
    if (!newResult.ok) {
      throw new Error(`${idea.id}: invalid historical event ${newResult.sequence}: ${newResult.code}`);
    }
    if (!isDeepStrictEqual(
      { status: newResult.state.status, sequence: newResult.state.sequence },
      oldResult.state,
    ) || !isDeepStrictEqual(newResult.state.interaction, { messages: [], lastSignal: null })) {
      throw new Error(`${idea.id}: migration projection differs from v2 facts`);
    }
    files.push({ path, before, after });
  }
  files.push({
    path: CONFIG_PATH,
    before: await regularBytes(resolve(root, CONFIG_PATH)),
    after: Buffer.from(serializeConfig({ ...config, version: 3 })),
  });
  const fingerprint = digest(JSON.stringify(files.map(({ path, before, after }) => ({
    path, before: before === null ? null : digest(before), after: digest(after),
  })).concat([{ primary }])));
  const receipt = {
    outcome: "migration-planned", written: false, digest: fingerprint,
    ideas: layout.ideas.map(({ id }) => id), primary,
  };
  if (!apply) return receipt;
  if (expectedDigest !== fingerprint) throw new Error("Migration plan changed; observe and confirm its exact digest before applying.");
  if (fetchPrimary(root, config) !== primary) {
    throw new Error("Primary moved since the migration plan; reobserve before applying.");
  }
  const repository = inspectRepositoryState(root);
  if (repository.head !== primary) {
    throw new Error("Migration requires the clean committed source at the fetched primary tip.");
  }
  if (["conflicted", "staged", "unstaged", "untracked"].some((key) => repository.changes[key].length)) {
    throw new Error("Migration requires a clean committed source; preserve all work before retrying.");
  }
  await stateTransaction(root, "migration", files, {
    afterStep, context: { sourceCommit: repository.head, primary, fromVersion: 2, toVersion: 3 },
    validate: () => {
      if (fetchPrimary(root, config) !== primary || inspectRepositoryState(root).head !== repository.head) {
        throw new Error("Primary or migration source moved before the transaction write.");
      }
    },
  });
  return { ...receipt, outcome: "migrated", written: true };
}
