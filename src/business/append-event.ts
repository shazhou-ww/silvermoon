
import { inspectProjectedEventHistory } from "../foundation/event-history/index.ts";
import {
  assertAppendTimestamp,
  assertHumanGate,
  deriveEventIdeaState,
  matchesBusinessRequest,
  parseRequest,
  planProjectedAppend,
  retryEventAfterDigest,
  validateExpectedDigestPrefix,
} from "../foundation/event-reducer/index.ts";
import { projectEventSnapshot } from "../foundation/projection-cache/index.ts";
import { eventStorageChanges, readEventStorage, snapshotEventFileHead, storageDigest } from "../foundation/event-store/index.ts";
import { createGitSnapshotFileSystem } from "../foundation/snapshot/index.ts";
import { fetchPrimary, inspectTreePaths, worktreeSnapshot } from "../foundation/git/index.ts";
import { parseIdeaEvents, replayIdeaEvents, serializeIdeaEvents } from "../foundation/event-codec/index.ts";
import { inspectIdeaLayout } from "./shared/index.ts";
import { stateTransaction } from "../foundation/state-transaction/index.ts";
import type {
  BusinessFileSystem,
  CommandRuntime,
  EventOptions,
  EventStore,
  IdeaPaths,
  ProjectConfig,
} from "./shared/business-types.ts";
import {
  asBusinessFileSystem,
  errorMessage,
  requireSnapshotFileSystem,
} from "./shared/business-types.ts";

interface InteractionArguments {
  root: string;
  id: string;
  paths: IdeaPaths;
  input: Record<string, unknown> | null;
  expectedLength?: number | undefined;
  expectedDigest?: string | undefined;
  options: EventOptions;
}

export function eventTimestamp(options: EventOptions) {
  return (options.now ?? (() => new Date()))().toISOString();
}

export async function appendLocalInteraction({
  root, id, paths, store, bytes, input, expectedLength, expectedDigest, options,
}: InteractionArguments & { store: EventStore; bytes: Buffer }) {
  const head = (source: Buffer) => storageDigest(store, source, options);
  if (expectedLength !== undefined) {
    throw new Error("Append no longer accepts --expected-length; use an optional digest prefix.");
  }
  validateExpectedDigestPrefix(expectedDigest, options.objectIdLength);
  if (expectedDigest !== undefined && !store.digest.startsWith(expectedDigest)) {
    const existing = retryEventAfterDigest(bytes, expectedDigest, options);
    if (existing && ["ping", "pong"].includes(existing.type)
      && matchesBusinessRequest(existing, input, options)) {
      const current = replayIdeaEvents(id, parseIdeaEvents(bytes, options), options);
      if (!current.ok || !("state" in current)) {
        throw new Error(`Current log reduction failed: ${"code" in current ? current.code : "missing-state"}`);
      }
      return {
        id, outcome: "already-present", written: false,
        length: bytes.length, digest: store.digest, sequence: current.state.sequence,
        ...(existing.timestamp === undefined ? {} : { timestamp: existing.timestamp }),
      };
    }
    throw new Error("Stale event digest; reobserve before responding to new messages.");
  }
  const events = parseIdeaEvents(bytes, options);
  const before = replayIdeaEvents(id, events, options);
  if (!before.ok || !("state" in before)) {
    throw new Error(`Current log reduction failed: ${"code" in before ? before.code : "missing-state"}`);
  }
  const timestamp = eventTimestamp(options);
  assertAppendTimestamp(events, timestamp);
  const event = parseRequest(input, before.state.sequence + 1, options, timestamp);
  const candidate = Buffer.concat([bytes, Buffer.from(serializeIdeaEvents([event], options))]);
  const after = replayIdeaEvents(id, parseIdeaEvents(candidate, options), options);
  if (!after.ok || !("state" in after)) {
    throw new Error(`Candidate reduction failed: ${"code" in after ? after.code : "missing-state"} at ${"sequence" in after ? after.sequence : "unknown"}`);
  }
  await stateTransaction(root, "events", eventStorageChanges(paths, store, candidate, options), {
    context: { id, localInteraction: true, storage: store.storage, afterDigest: head(candidate) },
    validate: async () => {
      const current = await readEventStorage(root, paths, options);
      if (current.digest !== store.digest || !current.bytes.equals(bytes)) throw new Error("Log changed before local interaction write.");
    },
    validateApplied: async () => {
      const current = await readEventStorage(root, paths, options);
      if (current.digest !== head(candidate)) throw new Error("Complete stream changed during local interaction commit.");
    },
  });
  return {
    id, outcome: "candidate-written", written: true,
    length: candidate.length, digest: head(candidate), sequence: after.state.sequence,
    timestamp,
  };
}

export async function appendProjectedInteraction({
  root, id, paths, filesystem, input, expectedLength, expectedDigest, options,
}: InteractionArguments & { filesystem: BusinessFileSystem }) {
  const snapshotFilesystem = requireSnapshotFileSystem(filesystem);
  if (expectedLength !== undefined) {
    throw new Error("Append no longer accepts --expected-length; use an optional digest prefix.");
  }
  validateExpectedDigestPrefix(expectedDigest, options.objectIdLength);
  const before = await projectEventSnapshot(root, id, paths, options, snapshotFilesystem);
  if (expectedDigest !== undefined && !before.digest.startsWith(expectedDigest)) {
    const existing = retryEventAfterDigest(before.bytes, expectedDigest, options);
    if (existing && ["ping", "pong"].includes(existing.type)
      && matchesBusinessRequest(existing, input, options)) {
      return {
        id, outcome: "already-present", written: false,
        length: before.length, digest: before.digest, sequence: before.state.sequence,
        ...(existing.timestamp === undefined ? {} : { timestamp: existing.timestamp }),
      };
    }
    throw new Error("Stale event digest; reobserve before responding to new messages.");
  }
  const timestamp = eventTimestamp(options);
  assertAppendTimestamp(parseIdeaEvents(before.bytes, options), timestamp);
  const event = parseRequest(input, before.state.sequence + 1, options, timestamp);
  if (event === undefined) throw new TypeError("Event request did not produce an event.");
  const planned = planProjectedAppend(before, paths, event, options);
  if (!planned.reduction.ok || !("state" in planned.reduction)) {
    throw new Error(`Candidate reduction failed: ${"code" in planned.reduction ? planned.reduction.code : "missing-state"} at ${"sequence" in planned.reduction ? planned.reduction.sequence : "unknown"}`);
  }
  await writeProjectedAppend(root, id, paths, before, planned, options, { localInteraction: true });
  return {
    id, outcome: "candidate-written", written: true,
    length: before.length + planned.record.length, digest: planned.digest,
    sequence: planned.reduction.state.sequence, timestamp,
  };
}

export async function writeProjectedAppend(
  root: string,
  id: string,
  paths: IdeaPaths,
  before: Awaited<ReturnType<typeof projectEventSnapshot>>,
  planned: ReturnType<typeof planProjectedAppend>,
  options: EventOptions,
  context: Record<string, unknown>,
  {
    validate,
    validateApplied,
  }: {
    validate?: () => void | Promise<void>;
    validateApplied?: () => void | Promise<void>;
  } = {},
) {
  if (planned.files === undefined) {
    throw new TypeError("Projected append did not produce transaction files.");
  }
  const liveHead = () => snapshotEventFileHead(root, paths, options,
    asBusinessFileSystem(
      createGitSnapshotFileSystem({
        gitRoot: root,
        tree: worktreeSnapshot(root, { reuseIndex: true }).tree,
      }),
    ));
  await stateTransaction(root, "events", planned.files, {
    context: { id, storage: "single-file", afterDigest: planned.digest, ...context },
    validate: async () => {
      if (await liveHead() !== before.digest) throw new Error("Complete event stream changed before write.");
      await validate?.();
    },
    validateApplied: async () => {
      if (await liveHead() !== planned.digest) throw new Error("Complete event stream changed during commit.");
      await validateApplied?.();
    },
  });
}

export async function appendProjectedMetadata({
  root, id, paths, filesystem, tree, config, input, expectedLength, expectedDigest,
  expectedPrimary, confirmDecision, options, runtime,
}: {
  root: string;
  id: string;
  paths: IdeaPaths;
  filesystem: BusinessFileSystem;
  tree: string;
  config: ProjectConfig;
  input: Record<string, unknown> | null;
  expectedLength?: number;
  expectedDigest?: string;
  expectedPrimary?: string;
  confirmDecision: boolean;
  options: EventOptions;
  runtime: CommandRuntime;
}) {
  const snapshotFilesystem = requireSnapshotFileSystem(filesystem);
  if (expectedLength !== undefined) {
    throw new Error("Append no longer accepts --expected-length; use an optional digest prefix.");
  }
  validateExpectedDigestPrefix(expectedDigest, options.objectIdLength);
  if (!new RegExp(`^[0-9a-f]{${options.objectIdLength}}$`).test(expectedPrimary ?? "")) {
    throw new Error("Writes require the exact observed primary commit.");
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
  const before = await projectEventSnapshot(root, id, paths, options, snapshotFilesystem);
  if (expectedDigest !== undefined && !before.digest.startsWith(expectedDigest)) {
    const existing = retryEventAfterDigest(before.bytes, expectedDigest, options);
    if (existing && matchesBusinessRequest(existing, input, options)) {
      return {
        supported: true, receipt: {
          id, outcome: "already-present", written: false,
          length: before.length, digest: before.digest,
          sequence: before.state.sequence, primary,
          ...(existing.timestamp === undefined ? {} : { timestamp: existing.timestamp }),
        }
      };
    }
    throw new Error("Stale event digest; reobserve before retrying the request.");
  }
  const timestamp = eventTimestamp(options);
  assertAppendTimestamp(parseIdeaEvents(before.bytes, options), timestamp);
  const event = parseRequest(input, before.state.sequence + 1, options, timestamp);
  if (event === undefined) throw new TypeError("Event request did not produce an event.");
  const planned = planProjectedAppend(before, paths, event, options);
  if (!planned.reduction.ok) {
    if (!("code" in planned.reduction) || planned.reduction.code !== "no-state-change") {
      throw new Error(`Candidate reduction failed: ${"code" in planned.reduction ? planned.reduction.code : "missing-code"}`);
    }
    return {
      supported: true, receipt: {
        id, outcome: "no-state-change", written: false,
        length: before.length, digest: before.digest, primary, timestamp,
      }
    };
  }
  if (!("state" in planned.reduction)) throw new Error("Candidate reduction did not return state.");
  const reductionState = planned.reduction.state;
  const layout = await inspectIdeaLayout({
    root, config, filesystem, snapshotTree: tree, projectedEvents: true,
    projectedRequests: new Map([[id, event]]),
  });
  if (layout.diagnostics.length) throw new Error(layout.diagnostics.map((item) => item.message).join("; "));
  const selected = layout.ideas.find((idea) => idea.id === id);
  if (!selected) throw new Error(`Candidate layout omitted idea ${id}.`);
  const history = await inspectProjectedEventHistory({ root, tree, primary });
  if (!history.supported) return history;
  const worlds = inspectTreePaths(root, primary, [paths.idealPath, paths.innerPath, paths.outerPath]);
  assertHumanGate(event, {
    ...selected,
    state: deriveEventIdeaState(selected.revisions, before.state.status),
    status: before.state.status,
  }, {
    idealRevision: worlds.get(paths.idealPath)?.object,
    implementationRevision: worlds.get(paths.innerPath)?.object,
    deploymentRevision: worlds.get(paths.outerPath)?.object,
  }, confirmDecision);
  const protectedPaths = [".silvermoon/ideas", ".silvermoon/config.yaml"];
  const protectedSignature = JSON.stringify([...inspectTreePaths(root, tree, protectedPaths)]);
  const action = await runtime.performAction({ type: "write-idea-events" }, async () => {
    await writeProjectedAppend(root, id, paths, before, planned, options,
      { primary, revisions: selected.revisions }, {
      validate: async () => {
        if (await refreshPrimary() !== primary) throw new Error("Primary moved before write; recover the unwritten transaction, then reobserve.");
        const live = worktreeSnapshot(root, { reuseIndex: true }).tree;
        if (JSON.stringify([...inspectTreePaths(root, live, protectedPaths)]) !== protectedSignature) {
          throw new Error("Worlds or project state changed during validation.");
        }
      },
      validateApplied: async () => {
        const live = worktreeSnapshot(root, { reuseIndex: true }).tree;
        const current = await inspectIdeaLayout({
          root, config, snapshotTree: live, projectedEvents: true,
          filesystem: asBusinessFileSystem(
            createGitSnapshotFileSystem({ gitRoot: root, tree: live }),
          ),
        });
        if (current.diagnostics.length) throw new Error(current.diagnostics.map((item) => item.message).join("; "));
        const idea = current.ideas.find((item) => item.id === id);
        const revisionKeys = [
          "idealRevision",
          "implementationRevision",
          "deploymentRevision",
        ] as const;
        if (!idea || revisionKeys.some((key) => idea.revisions[key] !== selected.revisions[key])) {
          throw new Error("Worlds changed during event commit.");
        }
      },
    });
    if (!history.results) throw new Error("Projected history omitted results.");
    const result = history.results.find((item) => item.id === id);
    if (!result) throw new Error(`Projected history omitted idea ${id}.`);
    const candidate = {
      length: before.length + planned.record.length, digest: planned.digest,
      sequence: reductionState.sequence
    };
    const updatedHistory = {
      ...history,
      results: history.results.map((item) =>
        item === result ? { ...item, candidate } : item
      ),
    };
    return {
      id, outcome: "candidate-written", written: true, primary,
      length: candidate.length, digest: planned.digest,
      sequence: reductionState.sequence, timestamp, history: updatedHistory,
    };
  }, (cause) => ({ problem: { type: "event.write-failed", summary: errorMessage(cause) } }));
  if (action.status === "failure") throw new Error(action.problem.summary);
  return { supported: true, receipt: action.result };
}
