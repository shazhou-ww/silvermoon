import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { EVENTS_PER_SEGMENT, MAX_EVENT_BYTES, eventFolderDigest } from "./event-stream.js";
import { initialEventState, parseIdeaEvents, reduceIdeaEvent } from "./idea-events.js";
import { isEventAuxiliary, snapshotEventFolderHead } from "./event-storage.js";
import { runGit } from "./git.js";
import { openDerivedCache } from "./derived-cache.js";

let runtimeIdentity;

export class ProjectedReductionError extends Error {
  constructor(result) {
    super(`Current log reduction failed: ${result.code} at ${result.sequence}`);
    this.name = "ProjectedReductionError";
    this.result = result;
  }
}

async function identity() {
  runtimeIdentity ??= Promise.all([
    "event-projection.js", "idea-events.js", "event-stream.js", "ideas.js",
    "event-storage.js", "git.js", "git-snapshot.js", "idea-layout.js", "derived-cache.js",
  ]
    .map((name) => readFile(new URL(name, import.meta.url))))
    .then((sources) => createHash("sha256").update(JSON.stringify(
      sources.map((bytes) => createHash("sha256").update(bytes).digest("hex")),
    )).digest("hex"));
  return runtimeIdentity;
}

function cacheLocation(root) {
  const worktree = createHash("sha256").update(resolve(root)).digest("hex");
  const result = runGit(root, ["rev-parse", "--path-format=absolute", "--git-path", `silvermoon-event-cache/${worktree}`]);
  if (!result.ok) throw new Error(`Cannot locate derived event cache: ${result.stderr}`);
  return openDerivedCache(result.stdout);
}

async function reduceSegment(filesystem, entry, ordinal, before, options, sealed) {
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
    state = { ...result.state, interaction: { ...result.state.interaction, messages: [] } };
  }
  return { state, bytes };
}

export async function projectEventSnapshot(root, id, paths, options, filesystem) {
  const head = await snapshotEventFolderHead(root, paths, options, filesystem);
  const entries = filesystem.snapshotEntries(paths.eventsDirectory)
    .filter(({ name }) => !isEventAuxiliary(name.slice(paths.eventsDirectory.length + 1)))
    .sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0);
  const cache = cacheLocation(root);
  const runtime = await identity();
  let state = initialEventState(id, options);
  const prefix = [];
  let length = 0;
  const contextFor = (segments) => JSON.stringify({
    runtime, id, digest: eventFolderDigest(segments, options), ordinal: segments.length,
  });
  for (const entry of entries.slice(0, -1)) {
    if (!Number.isSafeInteger(entry.size) || entry.size < 1) throw new Error("Invalid projected segment size.");
    length += entry.size;
    prefix.push({ name: entry.name.slice(paths.eventsDirectory.length + 1), object: entry.object });
  }
  let verified = prefix.length;
  while (verified > 0) {
    const context = contextFor(prefix.slice(0, verified));
    const cached = cache.read(context);
    if (cached) { state = cached; break; }
    verified--;
  }
  for (let index = verified; index < entries.length - 1; index++) {
    const entry = entries[index];
    const context = contextFor(prefix.slice(0, index + 1));
    state = (await reduceSegment(filesystem, entry, index + 1, state, options, true)).state;
    cache.write(context, state);
  }
  const tail = entries.at(-1);
  const reduced = await reduceSegment(filesystem, tail, entries.length, state, options, false);
  length += reduced.bytes.length;
  if (!Number.isSafeInteger(length)) throw new Error("Projected stream exceeds safe integer addressing.");
  return { digest: head, length, state: reduced.state, tail: { ...tail, bytes: reduced.bytes }, entries };
}
