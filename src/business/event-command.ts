import { resolve } from "node:path";
import { appendFullEvent } from "./append-event-history.ts";
import { resolveIdea } from "./shared/index.ts";
import { replayStoredEvents } from "./replay-events.ts";
import { appendProjectedInteraction, appendProjectedMetadata } from "./append-event.ts";

import { inspectAdoption } from "../foundation/skill-registration/index.ts";
import { createCommandRun } from "../foundation/command-message/index.ts";
import { readEventDelta } from "../foundation/event-cursor/index.ts";
import { readEventStorage } from "../foundation/event-store/index.ts";
import { createGitSnapshotFileSystem } from "../foundation/snapshot/index.ts";
import { worktreeSnapshot } from "../foundation/git/index.ts";
import { isValidUlid } from "../foundation/idea-model/index.ts";
import { localize, resolveOutputLanguage } from "../foundation/language/index.ts";
import { ideaPaths } from "../foundation/coordinates/index.ts";
import { errorMessage } from "./shared/business-types.ts";
import {
  asBusinessFileSystem,
  requireSnapshotFileSystem,
} from "./shared/business-types.ts";
import type { EventReceipt } from "../foundation/report/types.ts";

interface EventCommandOptions {
  operation?: string;
  idea?: string;
  root?: string;
  input?: unknown;
  language?: string;
  expectedLength?: number;
  expectedDigest?: string;
  expectedPrimary?: string;
  afterLength?: number;
  afterDigest?: string;
  fullHistory?: boolean;
  confirmDecision?: boolean;
}

function requestObject(value: unknown): Record<string, unknown> | null {
  if (value === null || value === undefined) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("Event input must be a JSON object.");
  }
  return Object.fromEntries(Object.entries(value));
}

function eventReceipt(value: unknown): EventReceipt {
  if (value === null || typeof value !== "object" || Array.isArray(value)
    || !("outcome" in value) || typeof value.outcome !== "string") {
    throw new TypeError("Event operation returned an invalid receipt.");
  }
  const receipt: EventReceipt = { outcome: value.outcome };
  for (const [key, entry] of Object.entries(value)) {
    if (
      entry === null || entry === undefined
      || typeof entry === "string" || typeof entry === "number"
      || typeof entry === "boolean" || typeof entry === "object"
    ) {
      receipt[key] = entry;
    } else {
      throw new TypeError(`Event receipt field ${key} is not serializable.`);
    }
  }
  return receipt;
}

function eventCursorFileSystem(
  filesystem: ReturnType<typeof requireSnapshotFileSystem>,
) {
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

const EVENTCOMMAND_PORTS = Object.freeze({ createCommandRun, inspectAdoption, worktreeSnapshot, resolveIdea, readEventStorage, readEventDelta, createGitSnapshotFileSystem, appendProjectedInteraction, appendProjectedMetadata, appendFullEvent, replayStoredEvents });

export async function eventCommandUseCase({
  operation, idea: selector, root = process.cwd(), input, language,
  expectedLength, expectedDigest, expectedPrimary,
  afterLength, afterDigest,
  fullHistory = false,
  confirmDecision = false,
}: EventCommandOptions = {}, ports: typeof EVENTCOMMAND_PORTS = EVENTCOMMAND_PORTS) {
  const { createCommandRun, inspectAdoption, worktreeSnapshot, resolveIdea, readEventStorage, readEventDelta, createGitSnapshotFileSystem, appendProjectedInteraction, appendProjectedMetadata, appendFullEvent, replayStoredEvents } = ports;
  root = resolve(root);
  const runtime = createCommandRun({
    command: "event",
    args: { operation, idea: selector ?? null, language: language ?? null },
  });
  let outputLanguage = resolveOutputLanguage({
    ...(language === undefined ? {} : { override: language }),
  }).tag;
  let receipt: EventReceipt;
  try {
    if (operation !== "replay" && operation !== "append") {
      throw new Error(`Unknown event operation: ${operation}`);
    }
      if (typeof selector !== "string") {
        throw new Error("Event commands require an idea selector.");
      }
      const adoption = await inspectAdoption({ root });
      if (adoption.findings.length || adoption.config?.version !== 2) {
        const summaries = adoption.problems.flatMap((problem) =>
          problem === undefined ? [] : [problem.summary]
        );
        throw new Error(summaries.join("; ") || "Event commands require an explicitly initialized or migrated event project.");
      }
      root = adoption.root;
      const config = adoption.config;
      outputLanguage = resolveOutputLanguage({
        ...(config.preferredLanguage === undefined
          ? {}
          : { content: config.preferredLanguage }),
        ...(language === undefined ? {} : { override: language }),
      }).tag;
      const incremental = operation === "replay" && (afterLength !== undefined || afterDigest !== undefined);
      if (incremental && !isValidUlid(selector)) {
        throw new Error("Incremental replay requires the canonical idea ULID; resolve an alias with full replay first.");
      }
      if (operation !== "replay" && (afterLength !== undefined || afterDigest !== undefined)) {
        throw new Error("Cursor options are only available for replay.");
      }
      if (fullHistory && operation !== "append") throw new Error("Full history output is only available for append.");
      const parsedInput = requestObject(input);
      const projectedInteraction = operation === "append" && ["ping", "pong"].includes(
        typeof parsedInput?.type === "string" ? parsedInput.type : "",
      );
      const projectedMetadata = operation === "append" && !projectedInteraction && !fullHistory;
      const { tree } = worktreeSnapshot(root, { reuseIndex: incremental || projectedInteraction || projectedMetadata });
      const options = {
        objectIdLength: tree.length,
      };
      if (incremental) {
        if (
          typeof afterLength !== "number" || !Number.isSafeInteger(afterLength)
          || typeof afterDigest !== "string"
        ) {
          throw new Error("Incremental replay requires both --after-length and --after-digest.");
        }
        const incrementalFilesystem = requireSnapshotFileSystem(asBusinessFileSystem(
          createGitSnapshotFileSystem({ gitRoot: root, tree }),
        ));
        receipt = {
          id: selector, ...await readEventDelta(
            root, ideaPaths(selector), options,
            eventCursorFileSystem(incrementalFilesystem),
            { length: afterLength, digest: afterDigest },
          )
        };
        return runtime.complete({
          state: "event-result",
          root,
          outputLanguage,
          problems: [],
          receipt: eventReceipt(receipt),
        });
      }
      const snapshot = createGitSnapshotFileSystem({ gitRoot: root, tree });
      const businessSnapshot = asBusinessFileSystem(snapshot);
      let fullHistoryReason = fullHistory ? "explicit-full-history" : null;
      const projectedId = projectedInteraction
        ? await resolveIdea(root, tree, config, selector, {
          projectedEvents: true,
          filesystem: businessSnapshot,
        })
        : null;
      if (projectedId && snapshot.snapshotEntry(ideaPaths(projectedId).eventsPath)) {
        if (expectedPrimary !== undefined) throw new Error("Local interaction append does not accept --expected-primary.");
        const action = await runtime.performAction({ type: "write-idea-events" }, () => appendProjectedInteraction({
          root, id: projectedId, paths: ideaPaths(projectedId), filesystem: businessSnapshot, input: parsedInput,
          expectedLength, expectedDigest, options,
        }), (cause) => ({ problem: { type: "event.write-failed", summary: errorMessage(cause) } }));
        if (action.status === "failure") throw new Error(action.problem.summary);
        return runtime.complete({
          state: "event-result",
          root,
          outputLanguage,
          problems: [],
          receipt: eventReceipt(action.result),
        });
      }
      if (projectedMetadata) {
        const id = await resolveIdea(root, tree, config, selector, {
          projectedEvents: true,
          filesystem: businessSnapshot,
        });
        if (snapshot.snapshotEntry(ideaPaths(id).eventsPath)) {
          const result = await appendProjectedMetadata({
            root, id, paths: ideaPaths(id), filesystem: businessSnapshot, tree, config, input: parsedInput,
            ...(expectedLength === undefined ? {} : { expectedLength }),
            ...(expectedDigest === undefined ? {} : { expectedDigest }),
            ...(expectedPrimary === undefined ? {} : { expectedPrimary }),
            confirmDecision, options, runtime,
          });
          if (result.supported && "receipt" in result) {
            return runtime.complete({
              state: "event-result",
              root,
              outputLanguage,
              problems: [],
              receipt: eventReceipt(result.receipt),
            });
          }
          if (!("reason" in result) || typeof result.reason !== "string") {
            throw new TypeError("Projected history returned an invalid unsupported result.");
          }
          fullHistoryReason = result.reason;
        }
      }
      const protectedPaths = [".silvermoon/ideas", ".silvermoon/config.yaml"];
      const protectedTree = worktreeSnapshot(root, { paths: protectedPaths }).tree;
      const id = await resolveIdea(root, tree, config, selector);
      const paths = ideaPaths(id);
      const store = await readEventStorage(root, paths, options, businessSnapshot);
      const { bytes } = store;
      const observation = { id, length: bytes.length, digest: store.digest };
      if (operation === "replay") {
        receipt = eventReceipt(
          replayStoredEvents({ root, config, id, store, options, observation }),
        );
      } else {
        receipt = eventReceipt(await appendFullEvent({
          root, config, id, tree, paths, store, options, runtime, observation, input: parsedInput,
          ...(expectedLength === undefined ? {} : { expectedLength }),
          ...(expectedDigest === undefined ? {} : { expectedDigest }),
          ...(expectedPrimary === undefined ? {} : { expectedPrimary }),
          confirmDecision,
          fullHistoryReason,
          protectedPaths, protectedTree,
        }));
      }
    return runtime.complete({
      state: "event-result",
      root,
      outputLanguage,
      problems: [],
      receipt: eventReceipt(receipt),
    });
  } catch (cause) {
    if (runtime.observation.progress === "ready") throw cause;
    return runtime.complete({
      state: "check-unavailable", root, outputLanguage,
      problems: [{ type: "event.failed", summary: errorMessage(cause) }],
    }, {
      nextSteps: localize(outputLanguage,
        "Preserve unknown work and reobserve the exact idea and primary. Exceptional history maintenance requires direct review of the complete events.jsonl file.",
        "保留未知修改并重新观察准确 idea 和 primary。异常历史维护需要直接审阅完整 events.jsonl 文件。")
    });
  }
}

export async function eventCommand(options: EventCommandOptions = {}) {
  return eventCommandUseCase(options);
}
