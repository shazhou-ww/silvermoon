
import { inspectProjectedEventHistory } from "../foundation/event-history/index.ts";
import { readEventDelta } from "../foundation/event-cursor/index.ts";
import { assertHumanGate, parseRequest, planProjectedAppend } from "../foundation/event-reducer/index.ts";
import { projectEventSnapshot } from "../foundation/projection-cache/index.ts";
import { eventStorageChanges, readEventStorage, snapshotEventFileHead, storageDigest } from "../foundation/event-store/index.ts";
import { createGitSnapshotFileSystem } from "../foundation/snapshot/index.ts";
import { fetchPrimary, inspectTreePaths, worktreeSnapshot } from "../foundation/git/index.ts";
import { parseIdeaEvents, replayIdeaEvents, serializeIdeaEvents } from "../foundation/event-codec/index.ts";
import { inspectIdeaLayout } from "./shared/index.ts";
import { deriveIdeaState } from "../foundation/idea-model/index.ts";
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

function eventCursorFileSystem(filesystem: ReturnType<typeof requireSnapshotFileSystem>) {
  const cursorEntry = (entry: ReturnType<typeof filesystem.snapshotEntry>) => {
    if (entry === null || entry === undefined) return entry;
    if (entry.size === null) {
      throw new TypeError(`Snapshot entry ${entry.name} does not have a file size.`);
    }
    return { ...entry, size: entry.size };
  };
  return {
    lstat: filesystem.lstat,
    readFile: filesystem.readFile,
    readdir: (path: string) => filesystem.readdir(path),
    snapshotEntry: (path: string) => cursorEntry(filesystem.snapshotEntry(path)),
    snapshotEntries: (path: unknown) => {
      if (typeof path !== "string") {
        throw new TypeError("Snapshot directory path must be a string.");
      }
      return filesystem.snapshotEntries(path).map((entry) => {
        const validated = cursorEntry(entry);
        if (validated === null || validated === undefined) {
          throw new TypeError("Snapshot directory returned an empty entry.");
        }
        return validated;
      });
    },
    snapshotFile: (path: unknown) => {
      if (typeof path !== "string") {
        throw new TypeError("Snapshot file path must be a string.");
      }
      return filesystem.snapshotFile(path);
    },
  };
}

interface InteractionArguments {
  root: string;
  id: string;
  paths: IdeaPaths;
  input: Record<string, unknown> | null;
  expectedLength?: number | undefined;
  expectedDigest?: string | undefined;
  options: EventOptions;
}

export async function appendLocalInteraction({
  root, id, paths, store, bytes, input, expectedLength, expectedDigest, options,
}: InteractionArguments & { store: EventStore; bytes: Buffer }) {
  const head = (source: Buffer) => storageDigest(store, source, options);
  if (typeof expectedLength !== "number" || !Number.isSafeInteger(expectedLength)
    || expectedLength < 0 || !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(expectedDigest ?? "")) {
    throw new Error("Interaction writes require --expected-length and --expected-digest from event replay.");
  }
  if (bytes.length !== expectedLength || store.digest !== expectedDigest) {
    if (bytes.length > expectedLength && head(bytes.subarray(0, expectedLength)) === expectedDigest) {
      const previous = replayIdeaEvents(id,
        parseIdeaEvents(bytes.subarray(0, expectedLength), options), options);
      if (previous.ok && "state" in previous) {
        const event = parseRequest(input, previous.state.sequence + 1, options);
        if (event === undefined) throw new TypeError("Event request did not produce an event.");
        const record = Buffer.from(serializeIdeaEvents([event], options));
        if (["ping", "pong"].includes(event.type)
          && bytes.subarray(expectedLength, expectedLength + record.length).equals(record)) {
          const current = replayIdeaEvents(id, parseIdeaEvents(bytes, options), options);
          if (!current.ok || !("state" in current)) {
            throw new Error(`Current log reduction failed: ${"code" in current ? current.code : "missing-state"}`);
          }
          return {
            id, outcome: "already-present", written: false,
            length: bytes.length, digest: store.digest, sequence: current.state.sequence
          };
        }
      }
    }
    throw new Error("Stale log length or digest; reobserve before responding to new messages.");
  }
  const before = replayIdeaEvents(id, parseIdeaEvents(bytes, options), options);
  if (!before.ok || !("state" in before)) {
    throw new Error(`Current log reduction failed: ${"code" in before ? before.code : "missing-state"}`);
  }
  const event = parseRequest(input, before.state.sequence + 1, options);
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
  };
}

export async function appendProjectedInteraction({
  root, id, paths, filesystem, input, expectedLength, expectedDigest, options,
}: InteractionArguments & { filesystem: BusinessFileSystem }) {
  const snapshotFilesystem = requireSnapshotFileSystem(filesystem);
  if (typeof expectedLength !== "number" || !Number.isSafeInteger(expectedLength) || expectedLength < 0
    || typeof expectedDigest !== "string"
    || !new RegExp(`^[0-9a-f]{${options.objectIdLength}}$`).test(expectedDigest ?? "")) {
    throw new Error("Interaction writes require an exact observed length and file digest.");
  }
  const before = await projectEventSnapshot(root, id, paths, options, snapshotFilesystem);
  if (before.length !== expectedLength || before.digest !== expectedDigest) {
    const delta = await readEventDelta(root, paths, options, eventCursorFileSystem(snapshotFilesystem),
      { length: expectedLength, digest: expectedDigest });
    const first = delta.events[0];
    if (first) {
      const proposed = parseRequest(input, first.sequence, options);
      if (proposed === undefined) {
        throw new TypeError("Event request did not produce an event.");
      }
      if (serializeIdeaEvents([first], options) === serializeIdeaEvents([proposed], options)) {
        return {
          id, outcome: "already-present", written: false,
          length: before.length, digest: before.digest, sequence: before.state.sequence
        };
      }
    }
    throw new Error("Stale log length or digest; do not renumber or replay the old request.");
  }
  const event = parseRequest(input, before.state.sequence + 1, options);
  if (event === undefined) throw new TypeError("Event request did not produce an event.");
  const planned = planProjectedAppend(before, paths, event, options);
  if (!planned.reduction.ok || !("state" in planned.reduction)) {
    throw new Error(`Candidate reduction failed: ${"code" in planned.reduction ? planned.reduction.code : "missing-state"} at ${"sequence" in planned.reduction ? planned.reduction.sequence : "unknown"}`);
  }
  await writeProjectedAppend(root, id, paths, before, planned, options, { localInteraction: true });
  return {
    id, outcome: "candidate-written", written: true,
    length: before.length + planned.record.length, digest: planned.digest, sequence: planned.reduction.state.sequence
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
  if (typeof expectedLength !== "number" || !Number.isSafeInteger(expectedLength) || expectedLength < 0
    || typeof expectedDigest !== "string"
    || !new RegExp(`^[0-9a-f]{${options.objectIdLength}}$`).test(expectedDigest ?? "")
    || !new RegExp(`^[0-9a-f]{${options.objectIdLength}}$`).test(expectedPrimary ?? "")) {
    throw new Error("Writes require exact observed length, file digest and primary.");
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
  if (before.length !== expectedLength || before.digest !== expectedDigest) {
    const delta = await readEventDelta(
      root,
      paths,
      options,
      eventCursorFileSystem(snapshotFilesystem),
      { length: expectedLength, digest: expectedDigest },
    );
    if (delta.events[0]) {
      const event = parseRequest(input, delta.events[0].sequence, options);
      if (event === undefined) throw new TypeError("Event request did not produce an event.");
      if (serializeIdeaEvents([event], options) === serializeIdeaEvents([delta.events[0]], options)) {
        return {
          supported: true, receipt: {
            id, outcome: "already-present", written: false,
            length: before.length, digest: before.digest, sequence: before.state.sequence, primary
          }
        };
      }
    }
    throw new Error("Stale log length or digest; do not renumber or replay the old request.");
  }
  const event = parseRequest(input, before.state.sequence + 1, options);
  if (event === undefined) throw new TypeError("Event request did not produce an event.");
  const planned = planProjectedAppend(before, paths, event, options);
  if (!planned.reduction.ok) {
    if (!("code" in planned.reduction) || planned.reduction.code !== "no-state-change") {
      throw new Error(`Candidate reduction failed: ${"code" in planned.reduction ? planned.reduction.code : "missing-code"}`);
    }
    return {
      supported: true, receipt: {
        id, outcome: "no-state-change", written: false,
        length: before.length, digest: before.digest, primary
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
    ...selected, state: deriveIdeaState(selected.revisions, { version: 1, ...before.state.status }),
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
      sequence: reductionState.sequence, history: updatedHistory,
    };
  }, (cause) => ({ problem: { type: "event.write-failed", summary: errorMessage(cause) } }));
  if (action.status === "failure") throw new Error(action.problem.summary);
  return { supported: true, receipt: action.result };
}
