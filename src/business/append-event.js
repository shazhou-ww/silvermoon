
import { inspectProjectedEventHistory } from "../foundation/event-history/index.js";
import { readEventDelta } from "../foundation/event-cursor/index.js";
import { assertHumanGate, parseRequest, planProjectedAppend } from "../foundation/event-reducer/index.js";
import { projectEventSnapshot } from "../foundation/projection-cache/index.js";
import { eventStorageChanges, readEventStorage, snapshotEventFolderHead, storageDigest } from "../foundation/event-store/index.js";
import { createGitSnapshotFileSystem } from "../foundation/snapshot/index.js";
import { fetchPrimary, inspectTreePaths, worktreeSnapshot } from "../foundation/git/index.js";
import { parseIdeaEvents, replayIdeaEvents, serializeIdeaEvents } from "../foundation/event-codec/index.js";
import { inspectIdeaLayout } from "./shared/index.js";
import { deriveIdeaState } from "../foundation/idea-model/index.js";
import { stateTransaction } from "../foundation/state-transaction/index.js";

export async function appendLocalInteraction({ root, id, paths, store, bytes, input, expectedLength, expectedDigest, options }) {
  const head = (source) => storageDigest(store, source, options);
  if (!Number.isSafeInteger(expectedLength) || expectedLength < 0 || !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(expectedDigest ?? "")) {
    throw new Error("Interaction writes require --expected-length and --expected-digest from event replay.");
  }
  if (bytes.length !== expectedLength || store.digest !== expectedDigest) {
    if (bytes.length > expectedLength && head(bytes.subarray(0, expectedLength)) === expectedDigest) {
      const previous = replayIdeaEvents(id,
        parseIdeaEvents(bytes.subarray(0, expectedLength), options), options);
      if (previous.ok) {
        const event = parseRequest(input, previous.state.sequence + 1, options);
        const record = Buffer.from(serializeIdeaEvents([event], options));
        if (["ping", "pong"].includes(event.type)
          && bytes.subarray(expectedLength, expectedLength + record.length).equals(record)) {
          const current = replayIdeaEvents(id, parseIdeaEvents(bytes, options), options);
          if (!current.ok) throw new Error(`Current log reduction failed: ${current.code}`);
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
  if (!before.ok) throw new Error(`Current log reduction failed: ${before.code}`);
  const event = parseRequest(input, before.state.sequence + 1, options);
  const candidate = Buffer.concat([bytes, Buffer.from(serializeIdeaEvents([event], options))]);
  const after = replayIdeaEvents(id, parseIdeaEvents(candidate, options), options);
  if (!after.ok) throw new Error(`Candidate reduction failed: ${after.code} at ${after.sequence}`);
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

export async function appendProjectedInteraction({ root, id, paths, filesystem, input, expectedLength, expectedDigest, options }) {
  if (!Number.isSafeInteger(expectedLength) || expectedLength < 0
    || !new RegExp(`^[0-9a-f]{${options.objectIdLength}}$`).test(expectedDigest ?? "")) {
    throw new Error("Interaction writes require an exact observed length and folder digest.");
  }
  const before = await projectEventSnapshot(root, id, paths, options, filesystem);
  if (before.length !== expectedLength || before.digest !== expectedDigest) {
    const delta = await readEventDelta(root, paths, options, filesystem,
      { length: expectedLength, digest: expectedDigest });
    const first = delta.events[0];
    if (first) {
      const proposed = parseRequest(input, first.sequence, options);
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
  const planned = planProjectedAppend(before, paths, event, options);
  if (!planned.reduction.ok) throw new Error(`Candidate reduction failed: ${planned.reduction.code} at ${planned.reduction.sequence}`);
  await writeProjectedAppend(root, id, paths, before, planned, options, { localInteraction: true });
  return {
    id, outcome: "candidate-written", written: true,
    length: before.length + planned.record.length, digest: planned.digest, sequence: planned.reduction.state.sequence
  };
}

export async function writeProjectedAppend(root, id, paths, before, planned, options, context, { validate, validateApplied } = {}) {
  const liveHead = () => snapshotEventFolderHead(root, paths, options,
    createGitSnapshotFileSystem({ gitRoot: root, tree: worktreeSnapshot(root, { reuseIndex: true }).tree }));
  await stateTransaction(root, "events", planned.files, {
    context: { id, storage: "segmented", afterDigest: planned.digest, ...context },
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
}) {
  if (!Number.isSafeInteger(expectedLength) || expectedLength < 0
    || !new RegExp(`^[0-9a-f]{${options.objectIdLength}}$`).test(expectedDigest ?? "")
    || !new RegExp(`^[0-9a-f]{${options.objectIdLength}}$`).test(expectedPrimary ?? "")) {
    throw new Error("Writes require exact observed length, folder digest and primary.");
  }
  const refreshPrimary = async () => {
    const action = await runtime.performAction({ type: "fetch-primary" },
      () => ({ commit: fetchPrimary(root, config) }),
      (cause) => ({ problem: { type: "primary-fetch-failed", summary: cause.message } }));
    if (action.status === "failure") throw new Error(action.problem.summary);
    return action.result.commit;
  };
  const primary = await refreshPrimary();
  if (primary !== expectedPrimary) throw new Error("Primary moved; preserve the candidate, synchronize and reassess the request.");
  const before = await projectEventSnapshot(root, id, paths, options, filesystem);
  if (before.length !== expectedLength || before.digest !== expectedDigest) {
    const delta = await readEventDelta(root, paths, options, filesystem, { length: expectedLength, digest: expectedDigest });
    if (delta.events[0]) {
      const event = parseRequest(input, delta.events[0].sequence, options);
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
  const planned = planProjectedAppend(before, paths, event, options);
  if (!planned.reduction.ok) {
    if (planned.reduction.code !== "no-state-change") throw new Error(`Candidate reduction failed: ${planned.reduction.code}`);
    return {
      supported: true, receipt: {
        id, outcome: "no-state-change", written: false,
        length: before.length, digest: before.digest, primary
      }
    };
  }
  const layout = await inspectIdeaLayout({
    root, config, filesystem, snapshotTree: tree, projectedEvents: true,
    projectedRequests: new Map([[id, event]]),
  });
  if (layout.diagnostics.length) throw new Error(layout.diagnostics.map((item) => item.message).join("; "));
  const selected = layout.ideas.find((idea) => idea.id === id);
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
          filesystem: createGitSnapshotFileSystem({ gitRoot: root, tree: live }),
        });
        if (current.diagnostics.length) throw new Error(current.diagnostics.map((item) => item.message).join("; "));
        const idea = current.ideas.find((item) => item.id === id);
        if (!idea || Object.keys(selected.revisions).some((key) => idea.revisions[key] !== selected.revisions[key])) {
          throw new Error("Worlds changed during event commit.");
        }
      },
    });
    const result = history.results.find((item) => item.id === id);
    result.candidate = {
      length: before.length + planned.record.length, digest: planned.digest,
      sequence: planned.reduction.state.sequence
    };
    return {
      id, outcome: "candidate-written", written: true, primary,
      length: result.candidate.length, digest: planned.digest, sequence: planned.reduction.state.sequence, history
    };
  }, (cause) => ({ problem: { type: "event.write-failed", summary: cause.message } }));
  if (action.status === "failure") throw new Error(action.problem.summary);
  return { supported: true, receipt: action.result };
}
