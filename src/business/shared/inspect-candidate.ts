import { basename, dirname, resolve } from "node:path";
import { createGitSnapshotFileSystem } from "../../foundation/snapshot/index.ts";
import { inspectIdeaLayout } from "./idea-layout.ts";
import type {
  BusinessFileSystem,
  DirectoryEntry,
  EventOptions,
  EventStore,
  ProjectConfig,
} from "./business-types.ts";
import { asBusinessFileSystem } from "./business-types.ts";

export async function inspectCandidate(
  root: string,
  tree: string,
  config: ProjectConfig,
  store: EventStore,
  bytes: Buffer,
  id: string,
  { recovering = false }: { recovering?: boolean } = {},
) {
  const path = store.path;
  const filesystem = createGitSnapshotFileSystem({ gitRoot: root, tree });
  const pending = `${path}.pending`;
  let hidePending = false;
  if (recovering && filesystem.snapshotEntry(pending)) {
    const entry = filesystem.snapshotEntry(pending);
    if (entry === null || entry.type !== "blob" || !["100644", "100755"].includes(entry.mode)
      || !(await filesystem.snapshotFile(pending)).equals(bytes)) {
      throw new Error("Unknown pending event bytes; preserve the recovery plan.");
    }
    hidePending = true;
  }
  function readDirectory(requested: string): Promise<string[]>;
  function readDirectory(
    requested: string,
    options: { withFileTypes: true },
  ): Promise<DirectoryEntry[]>;
  async function readDirectory(
    requested: string,
    options?: { withFileTypes: true },
  ): Promise<string[] | DirectoryEntry[]> {
    const entries = await filesystem.readdir(requested, options);
    const omitPending = hidePending
      && resolve(requested) === dirname(resolve(root, path));
    if (options === undefined) {
      const names: string[] = [];
      for (const candidate of entries) {
        if (typeof candidate !== "string") {
          throw new TypeError("Snapshot filesystem returned non-string directory entries.");
        }
        if (!omitPending || candidate !== basename(pending)) names.push(candidate);
      }
      return names;
    }
    const directoryEntries: DirectoryEntry[] = [];
    for (const candidate of entries) {
      if (
        typeof candidate !== "object" || candidate === null
        || !("name" in candidate) || typeof candidate.name !== "string"
      ) {
        throw new TypeError("Snapshot filesystem returned invalid directory metadata.");
      }
      if (!omitPending || candidate.name !== basename(pending)) {
        directoryEntries.push(candidate);
      }
    }
    return directoryEntries;
  }
  const candidateFilesystem: BusinessFileSystem = {
    ...asBusinessFileSystem(filesystem),
    readdir: readDirectory,
  };
  const layout = await inspectIdeaLayout({
    root, config, filesystem: candidateFilesystem, snapshotTree: tree,
    eventOverrides: new Map([[id, { ...store, bytes }]]),
  });
  if (layout.diagnostics.length) throw new Error(layout.diagnostics.map((d) => d.message).join("; "));
  return layout;
}
