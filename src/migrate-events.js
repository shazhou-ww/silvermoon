import { resolve } from "node:path";

import { inspectAdoption } from "./adoption.js";
import { serializeConfig } from "./config.js";
import { eventsFromStatus, parseIdeaEvents, replayIdeaEvents, serializeIdeaEvents } from "./idea-events.js";
import { inspectIdeaLayout } from "./idea-layout.js";
import { parseIdeaStatus } from "./ideas.js";
import { inspectRepositoryState, worktreeSnapshot } from "./git.js";
import { CONFIG_PATH, ideaPaths } from "./layout.js";
import { digest, recoverStateTransaction, regularBytes, stateTransaction } from "./state-transaction.js";
import { isDeepStrictEqual } from "node:util";

export async function migrateEvents({
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
    const validate = (plan) => {
      if (inspectRepositoryState(root).head !== plan.context?.sourceCommit) {
        throw new Error("Migration source commit changed; preserve the transaction rather than discarding potentially integrated facts.");
      }
    };
    return recoverStateTransaction(root, {
      rollback, confirmedStopped: confirmStopped, kind: "migration", validate, validateRollback: validate,
    });
  }
  const config = adoption.config;
  const { tree } = worktreeSnapshot(root);
  const layout = await inspectIdeaLayout({ root, config, snapshotTree: tree });
  if (layout.diagnostics.length) throw new Error(layout.diagnostics.map((d) => d.message).join("; "));
  if (config.version === 2) return { outcome: "already-v2", written: false };
  const files = [];
  for (const idea of layout.ideas) {
    const paths = ideaPaths(idea.id);
    const before = await regularBytes(resolve(root, paths.statusPath));
    if (before === null) throw new Error(`Missing migration source: ${paths.statusPath}`);
    if (await regularBytes(resolve(root, paths.eventsPath)) !== null) {
      throw new Error(`Refusing to overwrite existing ${paths.eventsPath}`);
    }
    const status = parseIdeaStatus(before.toString("utf8"), { objectIdLength: tree.length });
    const after = Buffer.from(serializeIdeaEvents(eventsFromStatus(status)));
    const result = replayIdeaEvents(idea.id, parseIdeaEvents(after));
    if (!result.ok || !isDeepStrictEqual({ version: 1, ...result.state.status }, status)) {
      throw new Error(`Migration projection differs for ${idea.id}`);
    }
    files.push(
      { path: paths.eventsPath, before: null, after },
      { path: paths.statusPath, before, after: null },
    );
  }
  files.push({
    path: CONFIG_PATH,
    before: await regularBytes(resolve(root, CONFIG_PATH)),
    after: Buffer.from(serializeConfig({ ...config, version: 2 })),
  });
  const fingerprint = digest(JSON.stringify(files.map(({ path, before, after }) => ({
    path, before: before === null ? null : digest(before), after: after === null ? null : digest(after),
  }))));
  const receipt = {
    outcome: "migration-planned", written: false, digest: fingerprint,
    ideas: layout.ideas.map(({ id }) => id),
    note: "Ordinary events reconstruct known facts in representation order, not historical chronology.",
  };
  if (!apply) return receipt;
  if (expectedDigest !== fingerprint) throw new Error("Migration plan changed; observe and confirm its exact digest before applying.");
  const repository = inspectRepositoryState(root);
  if (["conflicted", "staged", "unstaged", "untracked"].some((key) => repository.changes[key].length)) {
    throw new Error("Migration requires a clean committed source; preserve all work before retrying.");
  }
  await stateTransaction(root, "migration", files, {
    afterStep, context: { sourceCommit: repository.head },
  });
  return { ...receipt, outcome: "migrated", written: true };
}
