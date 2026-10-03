import { resolve } from "node:path";
import { writeFullEvents } from "./events/index.js";
import { resolveIdea } from "./observation/index.js";
import { recoverEvents } from "./events/index.js";
import { replayStoredEvents } from "./events/index.js";
import { appendProjectedInteraction, appendProjectedMetadata } from "./events/index.js";

import { inspectAdoption } from "../project/index.js";
import { createCommandRun } from "../command/index.js";
import { readEventDelta, readEventStorage } from "../events/index.js";
import { createGitSnapshotFileSystem } from "../repository/index.js";
import { worktreeSnapshot } from "../repository/index.js";
import { isValidUlid } from "../idea/rules/index.js";
import { localize, resolveOutputLanguage } from "../project/rules/index.js";
import { ideaPaths } from "../project/rules/index.js";

const EVENTCOMMAND_PORTS = Object.freeze({ createCommandRun, inspectAdoption, worktreeSnapshot, resolveIdea, readEventStorage, readEventDelta, createGitSnapshotFileSystem, recoverEvents, appendProjectedInteraction, appendProjectedMetadata, writeFullEvents, replayStoredEvents });

export async function eventCommandUseCase({
  operation, idea: selector, root = process.cwd(), input, language,
  expectedLength, expectedDigest, expectedPrimary,
  afterLength, afterDigest,
  fullHistory = false,
  confirmDecision = false, ownedSuffix = false, confirmStopped = false, rollback = false,
} = {}, ports = EVENTCOMMAND_PORTS) {
  const { createCommandRun, inspectAdoption, worktreeSnapshot, resolveIdea, readEventStorage, readEventDelta, createGitSnapshotFileSystem, recoverEvents, appendProjectedInteraction, appendProjectedMetadata, writeFullEvents, replayStoredEvents } = ports;
  root = resolve(root);
  const runtime = createCommandRun({
    command: "event",
    args: { operation, idea: selector ?? null, language: language ?? null },
  });
  let outputLanguage = resolveOutputLanguage({ override: language }).tag;
  let receipt;
  try {
    if (operation === "recover") {
      const recovered = await recoverEvents({ root, runtime, rollback, confirmStopped });
      root = recovered.root;
      receipt = recovered.receipt;
    } else {
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
        receipt = await writeFullEvents({
          root, config, id, tree, paths, store, options, runtime, observation, operation, input,
          expectedLength, expectedDigest, expectedPrimary, ownedSuffix, confirmDecision,
          fullHistoryReason, protectedPaths, protectedTree,
        });
      }
    }
    return runtime.complete({ state: "event-result", root, outputLanguage, problems: [], receipt });
  } catch (cause) {
    if (runtime.observation.progress === "ready") throw cause;
    return runtime.complete({
      state: "check-unavailable", root, outputLanguage,
      problems: [{ type: "event.failed", summary: cause.message }],
    }, {
      nextSteps: localize(outputLanguage,
        "Preserve unknown work. Reobserve the exact idea and primary; use explicit recovery for an interrupted transaction, never remove a lock by age.",
        "保留未知修改，重新观察准确 idea 和 primary。中断的事务应使用明确恢复入口，不按锁的年龄删除它。")
    });
  }
}

export async function eventCommand(options = {}) {
  return eventCommandUseCase(options);
}
