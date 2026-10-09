import {
  gitContentDigest,
  snapshotEventFileHead,
  validateEventRecordSizes,
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
  snapshotEntry?(path: string): SnapshotEntry | null | undefined;
};

export async function readEventDelta(
  root: string,
  paths: { eventsPath: string },
  options: { objectIdLength: number; legacy?: boolean },
  filesystem: SnapshotFileSystem,
  cursor: { length: number; digest: string },
) {
  if (!Number.isSafeInteger(cursor?.length) || cursor.length < 0
    || !new RegExp(`^[0-9a-f]{${options.objectIdLength}}$`).test(cursor.digest ?? "")) {
    throw new Error("Incremental replay requires an exact prior length and file digest.");
  }
  const head = await snapshotEventFileHead(root, paths, options, filesystem);
  const bytes = await filesystem.snapshotFile(paths.eventsPath);
  validateEventRecordSizes(bytes);
  if (cursor.length > bytes.length) {
    throw new Error("Stale cursor length; reobserve without replaying the old intent.");
  }
  const prefix = bytes.subarray(0, cursor.length);
  let prefixEvents: ReturnType<typeof parseIdeaEvents>;
  try {
    prefixEvents = parseIdeaEvents(prefix, options);
  } catch (cause) {
    throw new Error("Cursor length is not an event boundary.", { cause });
  }
  const prefixDigest = gitContentDigest("blob", prefix, options);
  if (prefixDigest !== cursor.digest) {
    throw new Error(
      "Stale cursor digest; historical content changed. Reobserve before deciding a new intent.",
    );
  }
  const events = parseIdeaEvents(bytes.subarray(cursor.length), {
    ...options,
    sequenceOffset: prefixEvents.length,
  });
  let lastTimestamp: string | undefined;
  for (const [index, event] of [...prefixEvents, ...events].entries()) {
    if (event.sequence !== index + 1) {
      throw new Error(
        `Event sequence is not continuous at record ${index + 1}.`,
      );
    }
    if (event.timestamp !== undefined) {
      if (lastTimestamp !== undefined && event.timestamp < lastTimestamp) {
        throw new Error(`Event timestamp regressed at record ${index + 1}.`);
      }
      lastTimestamp = event.timestamp;
    }
  }
  const cursorSequence = prefixEvents.at(-1)?.sequence ?? 0;
  return {
    outcome: "delta-observed",
    length: bytes.length,
    digest: head,
    after: { length: cursor.length, digest: cursor.digest },
    events,
    sequence: events.at(-1)?.sequence ?? cursorSequence,
  };
}
