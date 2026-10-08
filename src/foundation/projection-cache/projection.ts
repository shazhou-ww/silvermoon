import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  gitContentDigest,
  snapshotEventFileHead,
  validateEventRecordSizes,
} from "../event-store/index.ts";
import {
  initialEventState,
  parseIdeaEvents,
  reduceIdeaEvent,
} from "../event-codec/index.ts";
import type {
  EventCodecOptions,
  IdeaEventReduction,
  IdeaEventState,
} from "../event-codec/index.ts";
import { openDerivedCache, runGit } from "../git/index.ts";
import type { BusinessFileSystem } from "../../business/shared/business-types.ts";

interface ProjectionEntry {
  mode: string;
  type: string;
  object: string;
  size: number | null;
  name: string;
}

interface ProjectionFileSystem
  extends Pick<BusinessFileSystem, "lstat" | "readFile" | "readdir"> {
  snapshotEntry(path: string): ProjectionEntry | null | undefined;
  snapshotEntries(path: string): ProjectionEntry[];
  snapshotFile(path: string): Promise<Buffer>;
}

interface ProjectionPaths {
  eventsPath: string;
}

let runtimeIdentity: Promise<string> | undefined;

export class ProjectedReductionError extends Error {
  result: Extract<IdeaEventReduction, { ok: false }>;

  constructor(result: Extract<IdeaEventReduction, { ok: false }>) {
    super(`Current log reduction failed: ${result.code} at ${result.sequence}`);
    this.name = "ProjectedReductionError";
    this.result = result;
  }
}

async function identity() {
  runtimeIdentity ??= Promise.all([
    "./projection.ts",
    "../event-store/digest.ts",
    "../event-store/storage.ts",
    "../event-codec/grammar.ts",
    "../event-codec/index.ts",
    "../idea-model/status.ts",
    "../idea-model/index.ts",
    "../project-config/index.ts",
    "../git/derived-cache.ts",
    "../git/index.ts",
  ].map((name) => readFile(new URL(
    import.meta.url.endsWith(".ts") ? name : name.replace(/\.ts$/, ".js"),
    import.meta.url,
  )))).then((sources) => createHash("sha256").update(JSON.stringify(
    sources.map((bytes) => createHash("sha256").update(bytes).digest("hex")),
  )).digest("hex"));
  return runtimeIdentity;
}

function cacheLocation(root: string) {
  const worktree = createHash("sha256").update(resolve(root)).digest("hex");
  const result = runGit(root, [
    "rev-parse",
    "--path-format=absolute",
    "--git-path",
    `silvermoon-event-cache/${worktree}`,
  ]);
  if (!result.ok) throw new Error(`Cannot locate derived event cache: ${result.stderr}`);
  return openDerivedCache(result.stdout);
}

function isIdeaEventState(value: unknown): value is IdeaEventState {
  return value !== null
    && typeof value === "object"
    && "status" in value
    && value.status !== null
    && typeof value.status === "object"
    && "id" in value.status
    && typeof value.status.id === "string"
    && "sequence" in value
    && typeof value.sequence === "number";
}

export async function projectEventSnapshot(
  root: string,
  id: string,
  paths: ProjectionPaths,
  options: EventCodecOptions & { objectIdLength: number },
  filesystem: ProjectionFileSystem,
) {
  const digest = await snapshotEventFileHead(root, paths, options, filesystem);
  const entry = filesystem.snapshotEntry(paths.eventsPath);
  if (!entry || entry.type !== "blob" || !["100644", "100755"].includes(entry.mode)
    || entry.size === null || !Number.isSafeInteger(entry.size) || entry.size < 0) {
    throw new Error(`Invalid projected event file: ${paths.eventsPath}`);
  }
  const bytes = await filesystem.snapshotFile(paths.eventsPath);
  if (bytes.length !== entry.size) {
    throw new Error("Projected event file size disagrees with its immutable snapshot.");
  }
  if (gitContentDigest("blob", bytes, options) !== digest) {
    throw new Error("Projected event bytes disagree with their immutable snapshot.");
  }
  validateEventRecordSizes(bytes);
  const events = parseIdeaEvents(bytes, options);
  const context = JSON.stringify({
    runtime: await identity(),
    id,
    digest,
  });
  const cache = cacheLocation(root);
  const cached = cache.read(context);
  if (cached !== null) {
    if (!isIdeaEventState(cached)) {
      throw new Error("Invalid derived event cache state.");
    }
    return {
      digest,
      length: bytes.length,
      state: cached,
      bytes,
      entry,
    };
  }
  let state = initialEventState(id, options);
  for (const event of events) {
    const result = reduceIdeaEvent(state, event, options);
    if (!result.ok) throw new ProjectedReductionError(result);
    state = result.state;
  }
  cache.write(context, state);
  return {
    digest,
    length: bytes.length,
    state,
    bytes,
    entry,
  };
}
