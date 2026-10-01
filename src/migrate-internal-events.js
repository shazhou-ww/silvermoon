import { resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";

import { inspectAdoption } from "./adoption.js";
import { loadConfigSnapshot } from "./config.js";
import { parseIdeaEvents, renameLegacyEvents, replayIdeaEvents, serializeIdeaEvents } from "./idea-events.js";
import { inspectEventHistory, localPrimary, SOURCE_REPOSITORY } from "./event-history.js";
import { fetchPrimary, inspectRepositoryState, inspectTreeLineage, worktreeSnapshot } from "./git.js";
import { IDEAS_ROOT, ideaPaths } from "./layout.js";
import { digest, recoverStateTransaction, regularBytes, stateTransaction } from "./state-transaction.js";

export async function migrateInternalEvents({
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
      if (plan.context?.migration !== "legacy-events-to-final") {
        throw new Error("Transaction is not the internal legacy event migration; preserve its original recovery plan.");
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
  if (config.version !== 2 || config.primaryRepository !== SOURCE_REPOSITORY) {
    throw new Error("Legacy event migration is restricted to the Silvermoon source repository at config version 2.");
  }
  const primary = localPrimary(root, config).commit;
  const { tree } = worktreeSnapshot(root);
  await inspectEventHistory({ root, tree, config, primary });
  const ids = inspectTreeLineage(root, tree, IDEAS_ROOT)
    .filter(({ type, name }) => type === "tree" && name.split("/").length === 3)
    .map(({ name }) => name.split("/")[2]);
  const legacy = { legacy: true, objectIdLength: tree.length };
  const final = { objectIdLength: tree.length };
  const files = [];
  for (const id of ids) {
    const path = ideaPaths(id).eventsPath;
    const before = await regularBytes(resolve(root, path));
    if (before === null) throw new Error(`Missing migration source: ${path}`);
    const oldEvents = parseIdeaEvents(before, legacy);
    const oldResult = replayIdeaEvents(id, oldEvents, legacy);
    if (!oldResult.ok) throw new Error(`${id}: invalid legacy event ${oldResult.sequence}: ${oldResult.code}`);
    const converted = renameLegacyEvents(oldEvents);
    const after = Buffer.from(serializeIdeaEvents(converted, final));
    const newResult = replayIdeaEvents(id, parseIdeaEvents(after, final), final);
    if (!newResult.ok) {
      throw new Error(`${id}: invalid historical event ${newResult.sequence}: ${newResult.code}`);
    }
    if (!isDeepStrictEqual(
      { status: newResult.state.status, sequence: newResult.state.sequence },
      oldResult.state,
    ) || !isDeepStrictEqual(newResult.state.interaction, { messages: [], lastSignal: null })) {
      throw new Error(`${id}: migration projection differs from legacy facts`);
    }
    files.push({ path, before, after });
  }
  if (!files.some(({ before }) => before.length > 0)) {
    throw new Error("Cannot establish a legacy-to-final boundary: every idea log is empty.");
  }
  const fingerprint = digest(JSON.stringify(files.map(({ path, before, after }) => ({
    path, before: before === null ? null : digest(before), after: digest(after),
  })).concat([{ primary }])));
  const receipt = {
    outcome: "migration-planned", written: false, digest: fingerprint,
    ideas: ids, primary,
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
    afterStep, context: { sourceCommit: repository.head, primary, migration: "legacy-events-to-final" },
    validate: () => {
      if (fetchPrimary(root, config) !== primary || inspectRepositoryState(root).head !== repository.head) {
        throw new Error("Primary or migration source moved before the transaction write.");
      }
    },
  });
  return { ...receipt, outcome: "migrated", written: true };
}
