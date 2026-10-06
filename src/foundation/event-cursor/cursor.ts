import {
  EVENTS_PER_SEGMENT,
  MAX_EVENT_BYTES,
  eventFolderDigest,
  gitContentDigest,
  isEventAuxiliary,
  segmentName,
  snapshotEventFolderHead,
} from "../event-store/index.ts";
import { parseIdeaEvents } from "../event-codec/index.ts";

type SnapshotEntry = {
  mode: string;
  type: string;
  name: string;
  object: string;
  size: number;
};

type SnapshotFileSystem = {
  lstat(path: string): Promise<{
    isDirectory(): boolean;
    isFile(): boolean;
    isSymbolicLink(): boolean;
  }>;
  readFile(path: string): Promise<Buffer>;
  readdir(path: string): Promise<string[]>;
  snapshotEntries(path: unknown): SnapshotEntry[];
  snapshotFile(path: unknown): Promise<Buffer>;
  snapshotEntry?(path: string): SnapshotEntry|null|undefined;
};

export async function readEventDelta(
  root: string,
  paths: { eventsDirectory: string; legacyEventsPath: string },
  options: { objectIdLength: number; legacy?: boolean },
  filesystem: SnapshotFileSystem,
  cursor: { length: number; digest: string },
) {
  if (!Number.isSafeInteger(cursor?.length) || cursor.length < 0
    || !new RegExp(`^[0-9a-f]{${options.objectIdLength}}$`).test(cursor.digest ?? "")) {
    throw new Error("Incremental replay requires an exact prior length and folder digest.");
  }
  const head = await snapshotEventFolderHead(root, paths, options, filesystem);
  const entries = filesystem.snapshotEntries(paths.eventsDirectory)
    .filter(({ name }) => !isEventAuxiliary(name.slice(paths.eventsDirectory.length + 1)))
    .sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0);
  let length = 0;
  for (const entry of entries) {
    if (!Number.isSafeInteger(entry.size) || entry.size < 0
      || entry.size > EVENTS_PER_SEGMENT * MAX_EVENT_BYTES) {
      throw new Error("Invalid incremental segment size.");
    }
    length += entry.size;
  }
  if (!Number.isSafeInteger(length) || cursor.length > length) {
    throw new Error("Stale cursor length; reobserve without replaying the old intent.");
  }
  const prefix = [];
  const events = [];
  let offset = 0;
  let cursorSequence = 0;
  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index];
    if (!entry) throw new Error("Missing incremental segment entry.");
    const name = entry.name.slice(paths.eventsDirectory.length + 1);
    const end = offset + entry.size;
    if (end <= cursor.length && entry.size > 0 && index < entries.length - 1) {
      prefix.push({ name, object: entry.object });
      cursorSequence = (index + 1) * EVENTS_PER_SEGMENT;
      offset = end;
      continue;
    }
    const bytes = await filesystem.snapshotFile(entry.name);
    const records = parseIdeaEvents(bytes, options);
    if (records.length > EVENTS_PER_SEGMENT
      || (index < entries.length - 1 && records.length !== EVENTS_PER_SEGMENT)
      || (!records.length && entries.length !== 1)) {
      throw new Error("Invalid incremental segment record count.");
    }
    let recordOffset = offset;
    for (let position = 0; position < records.length; position++) {
      const event = records[position];
      if (!event) throw new Error("Missing incremental event record.");
      if (event.sequence !== index * EVENTS_PER_SEGMENT + position + 1) {
        throw new Error("Invalid incremental event sequence.");
      }
      const next = offset + bytes.indexOf(10, recordOffset - offset) + 1;
      if (next - recordOffset > MAX_EVENT_BYTES) throw new Error("Incremental event exceeds the byte limit.");
      if (recordOffset < cursor.length && next > cursor.length) {
        throw new Error("Cursor length is not an event boundary.");
      }
      if (next <= cursor.length) cursorSequence = event.sequence;
      else events.push(event);
      recordOffset = next;
    }
    if (offset < cursor.length && cursor.length <= end) {
      const partial = bytes.subarray(0, cursor.length - offset);
      prefix.push({ name, object: cursor.length === end ? entry.object : gitContentDigest("blob", partial, options) });
    }
    offset = end;
  }
  const prefixDigest = cursor.length === 0
    ? eventFolderDigest([{
      name: segmentName(1),
      object: gitContentDigest("blob", Buffer.alloc(0), options),
    }], options)
    : eventFolderDigest(prefix, options);
  if (prefixDigest !== cursor.digest) {
    throw new Error("Stale cursor digest; historical content changed. Reobserve before deciding a new intent.");
  }
  return {
    outcome: "delta-observed", length, digest: head,
    after: { length: cursor.length, digest: cursor.digest },
    events,
    sequence: events.at(-1)?.sequence ?? cursorSequence,
  };
}
