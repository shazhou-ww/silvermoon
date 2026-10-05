import { resolve } from "node:path";
import { appendFullEvent } from "./append-event-history.js";
import { resolveIdea } from "./shared/index.js";
import { replayStoredEvents } from "./replay-events.js";
import { appendProjectedInteraction, appendProjectedMetadata } from "./append-event.js";

import { inspectAdoption } from "../foundation/skill-registration/index.js";
import { createCommandRun } from "../foundation/command-message/index.js";
import { readEventDelta } from "../foundation/event-cursor/index.js";
import { readEventStorage } from "../foundation/event-store/index.js";
import { createGitSnapshotFileSystem } from "../foundation/snapshot/index.js";
import { worktreeSnapshot } from "../foundation/git/index.js";
import { isValidUlid } from "../foundation/idea-model/index.js";
import { localize, resolveOutputLanguage } from "../foundation/language/index.js";
import { ideaPaths } from "../foundation/coordinates/index.js";

const EVENTCOMMAND_PORTS = Object.freeze({ createCommandRun, inspectAdoption, worktreeSnapshot, resolveIdea, readEventStorage, readEventDelta, createGitSnapshotFileSystem, appendProjectedInteraction, appendProjectedMetadata, appendFullEvent, replayStoredEvents });

export async function eventCommandUseCase({
  operation, idea: selector, root = process.cwd(), input, language,
  expectedLength, expectedDigest, expectedPrimary,
  afterLength, afterDigest,
  fullHistory = false,
  confirmDecision = false,
} = {}, ports = EVENTCOMMAND_PORTS) {
  const { createCommandRun, inspectAdoption, worktreeSnapshot, resolveIdea, readEventStorage, readEventDelta, createGitSnapshotFileSystem, appendProjectedInteraction, appendProjectedMetadata, appendFullEvent, replayStoredEvents } = ports;
  root = resolve(root);
  const runtime = createCommandRun({
    command: "event",
    args: { operation, idea: selector ?? null, language: language ?? null },
  });
  let outputLanguage = resolveOutputLanguage({ override: language }).tag;
  let receipt;
  try {
    if (!["replay", "append"].includes(operation)) {
      throw new Error(`Unknown event operation: ${operation}`);
    }
      const adoption = await inspectAdoption({ root });
      if (adoption.findings.length || adoption.config?.version !== 2) {
        throw new Error(adoption.problems.map((p) => p.summary).join("; ") || "Event commands require an explicitly initialized or migrated event project.");
      }
      root = adoption.root;
      const config = adoption.config;
      outputLanguage = resolveOutputLanguage({ content: config.preferredLanguage, override: language }).tag;
      const incremental = operation === "replay" && (afterLength !== undefined || afterDigest !== undefined);
      if (incremental && !isValidUlid(selector)) {
        throw new Error("Incremental replay requires the canonical idea ULID; resolve an alias with full replay first.");
      }
      if (operation !== "replay" && (afterLength !== undefined || afterDigest !== undefined)) {
        throw new Error("Cursor options are only available for replay.");
      }
      if (fullHistory && operation !== "append") throw new Error("Full history output is only available for append.");
      const projectedInteraction = operation === "append" && ["ping", "pong"].includes(input?.type);
      const projectedMetadata = operation === "append" && !projectedInteraction && !fullHistory;
      const { tree } = worktreeSnapshot(root, { reuseIndex: incremental || projectedInteraction || projectedMetadata });
      const options = {
        objectIdLength: tree.length,
        allowSingleFile: config.primaryRepository === "https://github.com/shazhou-ww/silvermoon.git",
      };
      if (incremental) {
        receipt = {
          id: selector, ...await readEventDelta(
            root, ideaPaths(selector), options, createGitSnapshotFileSystem({ gitRoot: root, tree }),
            { length: afterLength, digest: afterDigest },
          )
        };
        return runtime.complete({ state: "event-result", root, outputLanguage, problems: [], receipt });
      }
      const snapshot = createGitSnapshotFileSystem({ gitRoot: root, tree });
      let fullHistoryReason = fullHistory ? "explicit-full-history" : null;
      const projectedId = projectedInteraction
        ? await resolveIdea(root, tree, config, selector, { projectedEvents: true, filesystem: snapshot })
        : null;
      if (projectedId && snapshot.snapshotEntry(ideaPaths(projectedId).eventsDirectory)) {
        if (expectedPrimary !== undefined) throw new Error("Local interaction append does not accept --expected-primary.");
        const action = await runtime.performAction({ type: "write-idea-events" }, () => appendProjectedInteraction({
          root, id: projectedId, paths: ideaPaths(projectedId), filesystem: snapshot, input,
          expectedLength, expectedDigest, options,
        }), (cause) => ({ problem: { type: "event.write-failed", summary: cause.message } }));
        if (action.status === "failure") throw new Error(action.problem.summary);
        return runtime.complete({ state: "event-result", root, outputLanguage, problems: [], receipt: action.result });
      }
      if (projectedMetadata) {
        const id = await resolveIdea(root, tree, config, selector, { projectedEvents: true, filesystem: snapshot });
        if (snapshot.snapshotEntry(ideaPaths(id).eventsDirectory)) {
          const result = await appendProjectedMetadata({
            root, id, paths: ideaPaths(id), filesystem: snapshot, tree, config, input,
            expectedLength, expectedDigest, expectedPrimary, confirmDecision, options, runtime,
          });
          if (result.supported) {
            return runtime.complete({ state: "event-result", root, outputLanguage, problems: [], receipt: result.receipt });
          }
          fullHistoryReason = result.reason;
        }
      }
      const protectedPaths = [".silvermoon/ideas", ".silvermoon/config.yaml"];
      const protectedTree = worktreeSnapshot(root, { paths: protectedPaths }).tree;
      const id = await resolveIdea(root, tree, config, selector);
      const paths = ideaPaths(id);
      const store = await readEventStorage(root, paths, options,
        createGitSnapshotFileSystem({ gitRoot: root, tree }));
      const { bytes } = store;
      const observation = { id, length: bytes.length, digest: store.digest };
      if (operation === "replay") {
        receipt = replayStoredEvents({ root, config, id, store, options, observation });
      } else {
        receipt = await appendFullEvent({
          root, config, id, tree, paths, store, options, runtime, observation, operation, input,
          expectedLength, expectedDigest, expectedPrimary, confirmDecision,
          fullHistoryReason, protectedPaths, protectedTree,
        });
      }
    return runtime.complete({ state: "event-result", root, outputLanguage, problems: [], receipt });
  } catch (cause) {
    if (runtime.observation.progress === "ready") throw cause;
    return runtime.complete({
      state: "check-unavailable", root, outputLanguage,
      problems: [{ type: "event.failed", summary: cause.message }],
    }, {
      nextSteps: localize(outputLanguage,
        "Preserve unknown work and reobserve the exact idea and primary. Exceptional history maintenance requires direct review of the complete events folder.",
        "保留未知修改并重新观察准确 idea 和 primary。异常历史维护需要直接审阅完整 events folder。")
    });
  }
}

export async function eventCommand(options = {}) {
  return eventCommandUseCase(options);
}
