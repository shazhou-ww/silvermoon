import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { EVENTS_PER_SEGMENT, MAX_EVENT_BYTES, eventFolderDigest } from "../event-store/index.ts";
import { initialEventState, parseIdeaEvents, reduceIdeaEvent } from "../event-codec/index.ts";
import type { EventCodecOptions, IdeaEventReduction, IdeaEventState } from "../event-codec/index.ts";
import { isEventAuxiliary, snapshotEventFolderHead } from "../event-store/index.ts";
import { runGit } from "../git/index.ts";
import { openDerivedCache } from "../git/index.ts";
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
  eventsDirectory: string;
  legacyEventsPath: string;
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
  "../event-codec/grammar.ts",
  "../event-store/stream.ts",
  "../event-store/digest.ts",
  "../idea-model/status.ts",
  "../event-store/storage.ts",
  "../git/git.ts",
  "../snapshot/git-snapshot.ts",
  "../../business/shared/idea-layout.ts",
  "../git/derived-cache.ts",
  "./index.ts",
  "../event-codec/index.ts",
  "../idea-model/index.ts",
  "../project-config/index.ts",
  "../language/index.ts",
  "../schema/yaml.ts",
  "../git/index.ts"
]
    .map((name) => readFile(new URL(
      import.meta.url.endsWith(".ts") ? name : name.replace(/\.ts$/, ".js"),
      import.meta.url,
    ))))
    .then((sources) => createHash("sha256").update(JSON.stringify(
      sources.map((bytes) => createHash("sha256").update(bytes).digest("hex")),
    )).digest("hex"));
  return runtimeIdentity;
}

function cacheLocation(root: string) {
  const worktree = createHash("sha256").update(resolve(root)).digest("hex");
  const result = runGit(root, ["rev-parse", "--path-format=absolute", "--git-path", `silvermoon-event-cache/${worktree}`]);
  if (!result.ok) throw new Error(`Cannot locate derived event cache: ${result.stderr}`);
  return openDerivedCache(result.stdout);
}

async function reduceSegment(
  filesystem: ProjectionFileSystem,
  entry: ProjectionEntry,
  ordinal: number,
  before: IdeaEventState,
  options: EventCodecOptions,
  sealed: boolean,
) {
  const bytes = await filesystem.snapshotFile(entry.name);
  const events = parseIdeaEvents(bytes, options);
  if (events.length > EVENTS_PER_SEGMENT || (sealed && events.length !== EVENTS_PER_SEGMENT)
    || (!events.length && ordinal !== 1)) throw new Error("Invalid projected segment record count.");
  let offset = 0;
  let state = before;
  for (const event of events) {
    const end = bytes.indexOf(10, offset) + 1;
    if (end - offset > MAX_EVENT_BYTES) throw new Error("Projected event exceeds the byte limit.");
    offset = end;
    const result = reduceIdeaEvent(state, event, options);
    if (!result.ok) throw new ProjectedReductionError(result);
    state = result.state.interaction === undefined
      ? result.state
      : { ...result.state, interaction: { ...result.state.interaction, messages: [] } };
  }
  return { state, bytes };
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
  const head = await snapshotEventFolderHead(root, paths, options, filesystem);
  const entries = filesystem.snapshotEntries(paths.eventsDirectory)
    .filter(({ name }) => !isEventAuxiliary(name.slice(paths.eventsDirectory.length + 1)))
    .sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0);
  const cache = cacheLocation(root);
  const runtime = await identity();
  let state = initialEventState(id, options);
  const prefix: { name: string; object: string }[] = [];
  let length = 0;
  const contextFor = (segments: { name: string; object: string }[]) => JSON.stringify({
    runtime, id, digest: eventFolderDigest(segments, options), ordinal: segments.length,
  });
  for (const entry of entries.slice(0, -1)) {
    if (!Number.isSafeInteger(entry.size) || entry.size === null || entry.size < 1) {
      throw new Error("Invalid projected segment size.");
    }
    length += entry.size;
    prefix.push({ name: entry.name.slice(paths.eventsDirectory.length + 1), object: entry.object });
  }
  let verified = prefix.length;
  while (verified > 0) {
    const context = contextFor(prefix.slice(0, verified));
    const cached = cache.read(context);
    if (cached) {
      if (!isIdeaEventState(cached)) throw new Error("Invalid derived event cache state.");
      state = cached;
      break;
    }
    verified--;
  }
  for (let index = verified; index < entries.length - 1; index++) {
    const entry = entries[index];
    if (entry === undefined) throw new Error("Missing projected segment.");
    const context = contextFor(prefix.slice(0, index + 1));
    state = (await reduceSegment(filesystem, entry, index + 1, state, options, true)).state;
    cache.write(context, state);
  }
  const tail = entries.at(-1);
  if (tail === undefined) throw new Error("Projected event stream is empty.");
  const reduced = await reduceSegment(filesystem, tail, entries.length, state, options, false);
  length += reduced.bytes.length;
  if (!Number.isSafeInteger(length)) throw new Error("Projected stream exceeds safe integer addressing.");
  return { digest: head, length, state: reduced.state, tail: { ...tail, bytes: reduced.bytes }, entries };
}
