import { inspectEventHistory } from "../foundation/event-history/index.ts";
import { inspectCandidate } from "./shared/index.ts";
import { assertIntroducedDecisions, parseRequest, planFullEventChange } from "../foundation/event-reducer/index.ts";
import { eventStorageChanges, readEventStorage, storageDigest } from "../foundation/event-store/index.ts";
import { appendLocalInteraction } from "./append-event.ts";
import { fetchPrimary, inspectTreePaths, worktreeSnapshot } from "../foundation/git/index.ts";
import { parseIdeaEvents, replayIdeaEvents, serializeIdeaEvents } from "../foundation/event-codec/index.ts";
import { stateTransaction } from "../foundation/state-transaction/index.ts";
import type {
  CommandRuntime,
  EventOptions,
  EventStore,
  IdeaPaths,
  ProjectConfig,
} from "./shared/business-types.ts";
import { errorMessage } from "./shared/business-types.ts";

export async function appendFullEvent({
  root, config, id, tree, paths, store, options, runtime, observation, input,
  expectedLength, expectedDigest, expectedPrimary, confirmDecision,
  fullHistoryReason, protectedPaths, protectedTree,
}: {
  root: string;
  config: ProjectConfig;
  id: string;
  tree: string;
  paths: IdeaPaths;
  store: EventStore;
  options: EventOptions;
  runtime: CommandRuntime;
  observation: Record<string, unknown>;
  input: Record<string, unknown> | null;
  expectedLength?: number;
  expectedDigest?: string;
  expectedPrimary?: string;
  confirmDecision: boolean;
  fullHistoryReason: string | null;
  protectedPaths: string[];
  protectedTree: string;
}) {
  const { bytes } = store;
  const head = (source: Buffer) => storageDigest(store, source, options);
  let receipt: Record<string, unknown> | undefined;

  if (input?.type === "ping" || input?.type === "pong") {
    if (expectedPrimary !== undefined) throw new Error("Local interaction append does not accept --expected-primary.");
    const action = await runtime.performAction({ type: "write-idea-events" },
      () => appendLocalInteraction({
        root, id, paths, store, bytes, input, expectedLength, expectedDigest, options,
      }),
      (cause) => ({ problem: { type: "event.write-failed", summary: errorMessage(cause) } }));
    if (action.status === "failure") throw new Error(action.problem.summary);
    receipt = action.result;
  } else {
    if (typeof expectedLength !== "number" || !Number.isSafeInteger(expectedLength) || expectedLength < 0
      || !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(expectedDigest ?? "")
      || !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(expectedPrimary ?? "")) {
      throw new Error("Writes require exact --expected-length, --expected-digest and --expected-primary from observation.");
    }
    const refreshPrimary = async () => {
      const action = await runtime.performAction({ type: "fetch-primary" },
        () => ({ commit: fetchPrimary(root, config) }),
        (cause) => ({ problem: { type: "primary-fetch-failed", summary: errorMessage(cause) } }));
      if (action.status === "failure") throw new Error(action.problem.summary);
      return action.result.commit;
    };
    const primary = await refreshPrimary();
    if (primary !== expectedPrimary) throw new Error("Primary moved; preserve the candidate, synchronize and reassess the request.");
    const prefix = bytes.subarray(0, expectedLength);
    const matches = bytes.length === expectedLength && store.digest === expectedDigest;
    if (!matches) {
      if (bytes.length > expectedLength && head(prefix) === expectedDigest) {
        const before = replayIdeaEvents(id, parseIdeaEvents(prefix, options), options);
        if (before.ok && "state" in before) {
          const event = parseRequest(input, before.state.sequence + 1, options);
          const record = Buffer.from(serializeIdeaEvents([event], options));
          if (bytes.subarray(expectedLength, expectedLength + record.length).equals(record)) {
            const result = replayIdeaEvents(id, parseIdeaEvents(bytes, options), options);
            if (!result.ok || !("state" in result)) {
              throw new Error(`Retry encountered invalid current state: ${"code" in result ? result.code : "missing-state"}`);
            }
            receipt = { ...observation, outcome: "already-present", written: false, primary };
          }
        }
      }
      if (!receipt) throw new Error("Stale log length or digest; do not renumber or replay the old request.");
    }
    if (!receipt) {
      const { candidate, reduction } = planFullEventChange({
        operation: "append", input, bytes, id,
      }, options);
      if (candidate.equals(bytes)) {
        receipt = { ...observation, outcome: "no-state-change", written: false, primary };
      }
      if (!reduction.ok) {
        if ("code" in reduction && reduction.code === "no-state-change") {
          receipt = { ...observation, outcome: "no-state-change", written: false, primary };
        } else {
          throw new Error(`Candidate reduction failed: ${"code" in reduction ? reduction.code : "missing-code"} at ${"sequence" in reduction ? reduction.sequence : "unknown"}`);
        }
      }
      if (!receipt && !("state" in reduction)) {
        throw new Error("Candidate reduction did not return state.");
      }
      if (!receipt) {
        if (!("state" in reduction)) throw new Error("Candidate reduction did not return state.");
        const reductionState = reduction.state;
        const layout = await inspectCandidate(root, tree, config, store, candidate, id);
        const selected = layout.ideas.find((idea) => idea.id === id);
        if (!selected) throw new Error(`Candidate layout omitted idea ${id}.`);
        const history = {
          ...await inspectEventHistory({
            root, tree, config, primary, overrides: new Map([[store.path, candidate]]),
          }),
          detail: "full",
          ...(fullHistoryReason ? { reason: fullHistoryReason } : {}),
        };
        // Check each newly introduced decision against its preceding state, never its own result.
        const worlds = inspectTreePaths(root, primary, [paths.idealPath, paths.innerPath, paths.outerPath]);
        const primaryWorlds = {
          idealRevision: worlds.get(paths.idealPath)?.object,
          implementationRevision: worlds.get(paths.innerPath)?.object,
          deploymentRevision: worlds.get(paths.outerPath)?.object,
        };
        assertIntroducedDecisions({
          id, operation: "append", bytes, candidate, revisions: selected.revisions,
          primaryWorlds, confirmed: confirmDecision,
        }, options);
        const action = await runtime.performAction({ type: "write-idea-events" }, async () => {
          await stateTransaction(root, "events", eventStorageChanges(paths, store, candidate, options), {
            context: { id, primary, revisions: selected.revisions, storage: store.storage, afterDigest: head(candidate) },
            validate: async () => {
              const live = await refreshPrimary();
              if (live !== primary) throw new Error("Primary moved before write; recover the unwritten transaction, then reobserve.");
              if (worktreeSnapshot(root, { paths: protectedPaths }).tree !== protectedTree) {
                throw new Error("Worlds changed during validation.");
              }
              const current = await readEventStorage(root, paths, options);
              if (current.digest !== store.digest) throw new Error("Complete event stream changed during validation.");
            },
            validateApplied: async () => {
              const current = await readEventStorage(root, paths, options);
              if (current.digest !== head(candidate)) throw new Error("Complete stream changed during event commit.");
              await inspectCandidate(root, worktreeSnapshot(root).tree, config, current, candidate, id);
            },
          });
          return {
            id, outcome: "candidate-written", written: true, primary,
            length: candidate.length, digest: head(candidate),
            sequence: reductionState.sequence, history,
          };
        }, (cause) => ({ problem: { type: "event.write-failed", summary: errorMessage(cause) } }));
        if (action.status === "failure") throw new Error(action.problem.summary);
        receipt = action.result;
      }
    }
  }

  return receipt;
}
