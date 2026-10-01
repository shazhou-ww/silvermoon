import { basename, dirname, resolve } from "node:path";

import { inspectAdoption } from "./adoption.js";
import { loadConfigSnapshot } from "./config.js";
import { createCommandRun } from "./domain.js";
import { inspectEventHistory, localPrimary } from "./event-history.js";
import { IdeaEventFormatError, parseIdeaEvents, replayIdeaEvents, serializeIdeaEvents } from "./idea-events.js";
import { inspectIdeaLayout } from "./idea-layout.js";
import { deriveIdeaState, isValidUlid } from "./ideas.js";
import { fetchPrimary, inspectTreePaths, worktreeSnapshot } from "./git.js";
import { createGitSnapshotFileSystem } from "./git-snapshot.js";
import { localize, resolveOutputLanguage } from "./language.js";
import { ideaPaths } from "./layout.js";
import { digest, recoverStateTransaction, stateBytes, stateTransaction } from "./state-transaction.js";

const DECISIONS = {
  "ideal.approved": ["idealRevision", "preparing"],
  "implementation.accepted": ["implementationRevision", "implementing"],
  "deployment.accepted": ["deploymentRevision", "deploying"],
};

function parseRequest(input, sequence) {
  if (input === null || typeof input !== "object" || Array.isArray(input)
    || Object.hasOwn(input, "sequence")) {
    throw new Error("Supply a business request object without sequence; the CLI assigns it.");
  }
  const event = { sequence, ...input };
  // Round-trip through the strict parser rejects unknown/missing business fields.
  return parseIdeaEvents(serializeIdeaEvents([event]))[0];
}

async function inspectCandidate(root, tree, config, path, bytes, { recovering = false } = {}) {
  const filesystem = createGitSnapshotFileSystem({ gitRoot: root, tree });
  const pending = `${path}.pending`;
  if (recovering && filesystem.snapshotEntry(pending)) {
    const entry = filesystem.snapshotEntry(pending);
    if (entry.type !== "blob" || !["100644", "100755"].includes(entry.mode)
      || !(await filesystem.snapshotFile(pending)).equals(bytes)) {
      throw new Error("Unknown pending event bytes; preserve the recovery plan.");
    }
    const readDirectory = filesystem.readdir;
    filesystem.readdir = async (requested, options) => {
      const entries = await readDirectory(requested, options);
      return resolve(requested) === dirname(resolve(root, path))
        ? entries.filter((entry) => (typeof entry === "string" ? entry : entry.name) !== basename(pending))
        : entries;
    };
  }
  const read = filesystem.readFile;
  filesystem.readFile = async (requested, encoding) => resolve(requested) === resolve(root, path)
    ? encoding === undefined ? Buffer.from(bytes) : bytes.toString(encoding)
    : read(requested, encoding);
  const layout = await inspectIdeaLayout({ root, config, filesystem, snapshotTree: tree });
  if (layout.diagnostics.length) throw new Error(layout.diagnostics.map((d) => d.message).join("; "));
  return layout;
}

async function resolveIdea(root, tree, config, selector) {
  // A canonical identity remains usable for repairing an invalid current projection.
  if (isValidUlid(selector)) return selector;
  const layout = await inspectIdeaLayout({ root, config, snapshotTree: tree });
  if (layout.diagnostics.length) throw new Error("Use the exact idea ULID while repairing an invalid layout.");
  const idea = layout.ideas.find(({ alias }) => alias === selector);
  if (!idea) throw new Error(`Unknown idea selector: ${selector}`);
  return idea.id;
}

function assertHumanGate(event, idea, primaryWorlds, confirmed) {
  const decision = DECISIONS[event.type];
  if (!decision && !["idea.abandoned", "idea.resumed"].includes(event.type)) return;
  if (!confirmed) throw new Error("This event requires an explicit human decision; --confirm-decision asserts one, it does not create authorization.");
  if (!decision) return;
  const [revision, state] = decision;
  if (idea.state !== state || event.payload[revision] !== idea.revisions[revision]
    || event.payload[revision] !== primaryWorlds[revision]) {
    throw new Error(`Decision requires ${state} and its exact world revision already synchronized to primary.`);
  }
}

export async function eventCommand({
  operation, idea: selector, root = process.cwd(), input, language,
  expectedLength, expectedDigest, expectedPrimary,
  confirmDecision = false, ownedSuffix = false, confirmStopped = false, rollback = false,
} = {}) {
  root = resolve(root);
  const runtime = createCommandRun({
    command: "event",
    args: { operation, idea: selector ?? null, language: language ?? null },
  });
  let outputLanguage = resolveOutputLanguage({ override: language }).tag;
  let receipt;
  try {
    if (operation === "recover") {
      const adoption = await inspectAdoption({ root });
      const blockers = adoption.findings.filter(({ sourceDiagnostic }) =>
        !sourceDiagnostic?.message.includes("Unfinished state transaction"));
      if (blockers.length) throw new Error(blockers.map(({ problem }) => problem.summary).join("; "));
      root = adoption.root;
      const action = await runtime.performAction({ type: "recover-state-transaction" },
        () => recoverStateTransaction(root, {
          rollback, confirmedStopped: confirmStopped, kind: "events",
          validate: async (plan) => {
            if (plan.files.length !== 1 || !plan.context?.id || !plan.context?.primary) {
              throw new Error("Event recovery context is missing; preserve the plan.");
            }
            const { tree } = worktreeSnapshot(root);
            const loaded = await loadConfigSnapshot({ gitRoot: root, tree });
            if (loaded.config?.version !== 2) throw new Error("Event recovery requires the original v2 project.");
            const fetched = await runtime.performAction({ type: "fetch-primary" },
              () => ({ commit: fetchPrimary(root, loaded.config) }),
              (cause) => ({ problem: { type: "primary-fetch-failed", summary: cause.message } }));
            if (fetched.status === "failure") throw new Error(fetched.problem.summary);
            const primary = fetched.result.commit;
            if (primary !== plan.context.primary) throw new Error("Primary moved; resume cannot replay this stale write. Roll back owned bytes, then reobserve.");
            const file = plan.files[0];
            const candidate = Buffer.from(file.after, "base64");
            const layout = await inspectCandidate(root, tree, loaded.config, file.path, candidate, { recovering: true });
            const idea = layout.ideas.find(({ id }) => id === plan.context.id);
            if (!idea || Object.keys(plan.context.revisions).some((key) => idea.revisions[key] !== plan.context.revisions[key])) {
              throw new Error("Worlds changed; obtain a fresh decision instead of resuming the stale write.");
            }
            await inspectEventHistory({
              root, tree, config: loaded.config, primary, overrides: new Map([[file.path, candidate]]),
            });
          },
        }),
        (cause) => ({ problem: { type: "event.recovery-failed", summary: cause.message } }));
      if (action.status === "failure") throw new Error(action.problem.summary);
      receipt = action.result;
    } else {
      const adoption = await inspectAdoption({ root });
      if (adoption.findings.length || adoption.config?.version !== 2) {
        throw new Error(adoption.problems.map((p) => p.summary).join("; ") || "Event commands require an explicitly initialized or migrated v2 project.");
      }
      root = adoption.root;
      const config = adoption.config;
      outputLanguage = resolveOutputLanguage({ content: config.preferredLanguage, override: language }).tag;
      const { tree } = worktreeSnapshot(root);
      const protectedPaths = [".silvermoon/ideas", ".silvermoon/config.yaml"];
      const protectedTree = worktreeSnapshot(root, { paths: protectedPaths }).tree;
      const id = await resolveIdea(root, tree, config, selector);
      const paths = ideaPaths(id);
      const bytes = await stateBytes(root, paths.eventsPath);
      if (bytes === null) throw new Error(`Missing ${paths.eventsPath}; it is not an empty log.`);
      const observation = { id, length: bytes.length, digest: digest(bytes) };
      if (operation === "replay") {
        let reduction = null;
        let format = { ok: true };
        try {
          const options = { objectIdLength: tree.length };
          reduction = replayIdeaEvents(id, parseIdeaEvents(bytes, options), options);
        }
        catch (error) {
          if (!(error instanceof IdeaEventFormatError)) throw error;
          format = { ok: false, error: error.message };
        }
        receipt = { ...observation, outcome: "observed", format, reduction, baseline: localPrimary(root, config) };
      } else {
        if (!["append", "revise"].includes(operation)) throw new Error(`Unknown event operation: ${operation}`);
        if (!Number.isSafeInteger(expectedLength) || expectedLength < 0
          || !/^[0-9a-f]{64}$/.test(expectedDigest ?? "")
          || !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(expectedPrimary ?? "")) {
          throw new Error("Writes require exact --expected-length, --expected-digest and --expected-primary from observation.");
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
        const prefix = bytes.subarray(0, expectedLength);
        const matches = bytes.length === expectedLength && digest(bytes) === expectedDigest;
        if (!matches) {
          if (operation === "append" && bytes.length > expectedLength && digest(prefix) === expectedDigest) {
            const before = replayIdeaEvents(id, parseIdeaEvents(prefix));
            if (before.ok) {
              const event = parseRequest(input, before.state.sequence + 1);
              const record = Buffer.from(serializeIdeaEvents([event]));
              if (bytes.subarray(expectedLength, expectedLength + record.length).equals(record)) {
                const result = replayIdeaEvents(id, parseIdeaEvents(bytes));
                if (!result.ok) throw new Error(`Retry encountered invalid current state: ${result.code}`);
                receipt = { ...observation, outcome: "already-present", written: false, primary };
              }
            }
          }
          if (!receipt) throw new Error("Stale log length or digest; do not renumber or replay the old request.");
        }
        if (!receipt) {
          let candidate;
          let proposed;
          if (operation === "append") {
            const before = replayIdeaEvents(id, parseIdeaEvents(bytes));
            if (!before.ok) throw new Error(`Current log reduction failed: ${before.code}; inspect primary and use revise for authorized repair.`);
            proposed = [parseRequest(input, before.state.sequence + 1)];
            candidate = Buffer.concat([bytes, Buffer.from(serializeIdeaEvents(proposed))]);
          } else {
            if (!ownedSuffix || !Array.isArray(input)) throw new Error("Revise requires --owned-suffix and an array of reviewed business requests for the complete resulting log.");
            proposed = input.map((request, index) => parseRequest(request, index + 1));
            candidate = Buffer.from(serializeIdeaEvents(proposed));
          }
          const reduction = replayIdeaEvents(id, parseIdeaEvents(candidate));
          if (candidate.equals(bytes)) {
            receipt = { ...observation, outcome: "no-state-change", written: false, primary };
          }
          if (!reduction.ok) {
            if (operation === "append" && reduction.code === "no-state-change") {
              receipt = { ...observation, outcome: "no-state-change", written: false, primary };
            } else throw new Error(`Candidate reduction failed: ${reduction.code} at ${reduction.sequence}`);
          }
          if (!receipt) {
            const layout = await inspectCandidate(root, tree, config, paths.eventsPath, candidate);
            const selected = layout.ideas.find((idea) => idea.id === id);
            const history = await inspectEventHistory({
              root, tree, config, primary, overrides: new Map([[paths.eventsPath, candidate]]),
            });
            // Check each newly introduced decision against its preceding state, never its own result.
            const worlds = inspectTreePaths(root, primary, [paths.idealPath, paths.innerPath, paths.outerPath]);
            const primaryWorlds = {
              idealRevision: worlds.get(paths.idealPath)?.object,
              implementationRevision: worlds.get(paths.innerPath)?.object,
              deploymentRevision: worlds.get(paths.outerPath)?.object,
            };
            let oldEvents = [];
            try { oldEvents = parseIdeaEvents(bytes); }
            catch (error) {
              if (operation !== "revise" || !(error instanceof IdeaEventFormatError)) throw error;
              // The valid primary prefix is still enforced by inspectEventHistory.
            }
            const candidateEvents = parseIdeaEvents(candidate);
            let oldPosition = 0;
            for (let index = 0; index < candidateEvents.length; index++) {
              const event = candidateEvents[index];
              const businessRecord = (value) => serializeIdeaEvents([{ ...value, sequence: 1 }]);
              const preserved = oldEvents.findIndex((old, position) =>
                position >= oldPosition && businessRecord(old) === businessRecord(event));
              if (preserved >= 0) {
                oldPosition = preserved + 1;
                continue;
              }
              const before = replayIdeaEvents(id, candidateEvents.slice(0, index)).state;
              assertHumanGate(event, {
                ...selected,
                state: deriveIdeaState(selected.revisions, { version: 1, ...before.status }),
              }, primaryWorlds, confirmDecision);
            }
            const action = await runtime.performAction({ type: "write-idea-events" }, async () => {
              await stateTransaction(root, "events", [{ path: paths.eventsPath, before: bytes, after: candidate }], {
                context: { id, primary, revisions: selected.revisions },
                validate: async () => {
                  const live = await refreshPrimary();
                  if (live !== primary) throw new Error("Primary moved before write; recover the unwritten transaction, then reobserve.");
                  if (worktreeSnapshot(root, { paths: protectedPaths }).tree !== protectedTree) {
                    throw new Error("Worlds changed during validation.");
                  }
                },
              });
              return {
                id, outcome: "candidate-written", written: true, primary,
                length: candidate.length, digest: digest(candidate),
                sequence: reduction.state.sequence, history,
              };
            }, (cause) => ({ problem: { type: "event.write-failed", summary: cause.message } }));
            if (action.status === "failure") throw new Error(action.problem.summary);
            receipt = action.result;
          }
        }
      }
    }
    return runtime.complete({ state: "event-result", root, outputLanguage, problems: [], receipt });
  } catch (cause) {
    return runtime.complete({
      state: "check-unavailable", root, outputLanguage,
      problems: [{ type: "event.failed", summary: cause.message }],
    }, { nextSteps: localize(outputLanguage,
      "Preserve unknown work. Reobserve the exact idea and primary; use explicit recovery for an interrupted transaction, never remove a lock by age.",
      "保留未知修改，重新观察准确 idea 和 primary。中断的事务应使用明确恢复入口，不按锁的年龄删除它。") });
  }
}
