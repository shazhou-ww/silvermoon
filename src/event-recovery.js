

import { inspectAdoption } from "./adoption.js";
import { loadConfigSnapshot } from "./config.js";
import { inspectEventHistory } from "./event-history.js";
import { inspectCandidate } from "./event-observation.js";
import { readRecoveryEventStorage, storageDigest } from "./event-storage.js";
import { EventStream } from "./event-stream.js";
import { fetchPrimary, worktreeSnapshot } from "./git.js";
import { parseIdeaEvents, replayIdeaEvents } from "./idea-events.js";
import { ideaPaths } from "./layout.js";
import { recoverStateTransaction } from "./state-transaction.js";

export async function recoverEvents({ root, runtime, rollback, confirmStopped }) {
  const adoption = await inspectAdoption({ root });
  const blockers = adoption.findings.filter(({ sourceDiagnostic }) =>
    !sourceDiagnostic?.message.includes("Unfinished state transaction"));
  if (blockers.length) throw new Error(blockers.map(({ problem }) => problem.summary).join("; "));
  root = adoption.root;
  const action = await runtime.performAction({ type: "recover-state-transaction" },
    () => recoverStateTransaction(root, {
      rollback, confirmedStopped: confirmStopped, kind: "events",
      validate: async (plan) => {
        if (!plan.files.length || !plan.context?.id
          || (!plan.context.localInteraction && !plan.context.primary)) {
          throw new Error("Event recovery context is missing; preserve the plan.");
        }
        const { tree } = worktreeSnapshot(root);
        const loaded = await loadConfigSnapshot({ gitRoot: root, tree });
        if (loaded.config?.version !== 2) throw new Error("Event recovery requires the original v2 project.");
        const paths = ideaPaths(plan.context.id);
        const eventOptions = {
          objectIdLength: tree.length,
          allowSingleFile: loaded.config.primaryRepository === "https://github.com/shazhou-ww/silvermoon.git",
        };
        const store = await readRecoveryEventStorage(root, paths, eventOptions, plan.files);
        if (store.storage !== plan.context.storage) throw new Error("Event recovery storage changed.");
        const candidate = store.storage === "segmented"
          ? EventStream.fromSegments(store.entries, eventOptions).bytes()
          : store.bytes;
        if (plan.context.afterDigest && storageDigest(store, candidate, eventOptions) !== plan.context.afterDigest) {
          throw new Error("Event recovery candidate digest changed.");
        }
        if (plan.context.localInteraction) {
          const result = replayIdeaEvents(plan.context.id,
            parseIdeaEvents(candidate, eventOptions), eventOptions);
          if (!result.ok) throw new Error(`Invalid local interaction recovery: ${result.code}`);
          return;
        }
        const fetched = await runtime.performAction({ type: "fetch-primary" },
          () => ({ commit: fetchPrimary(root, loaded.config) }),
          (cause) => ({ problem: { type: "primary-fetch-failed", summary: cause.message } }));
        if (fetched.status === "failure") throw new Error(fetched.problem.summary);
        const primary = fetched.result.commit;
        if (primary !== plan.context.primary) throw new Error("Primary moved; resume cannot replay this stale write. Roll back owned bytes, then reobserve.");
        const layout = await inspectCandidate(root, tree, loaded.config, store, candidate, plan.context.id, { recovering: true });
        const idea = layout.ideas.find(({ id }) => id === plan.context.id);
        if (!idea || Object.keys(plan.context.revisions).some((key) => idea.revisions[key] !== plan.context.revisions[key])) {
          throw new Error("Worlds changed; obtain a fresh decision instead of resuming the stale write.");
        }
        await inspectEventHistory({
          root, tree, config: loaded.config, primary, overrides: new Map([[store.path, candidate]]),
        });
      },
    }),
    (cause) => ({ problem: { type: "event.recovery-failed", summary: cause.message } }));
  if (action.status === "failure") throw new Error(action.problem.summary);
  return { root, receipt: action.result };
}
