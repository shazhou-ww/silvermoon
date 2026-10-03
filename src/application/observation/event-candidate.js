import { basename, dirname, resolve } from "node:path";
import { createGitSnapshotFileSystem } from "../../repository/index.js";
import { inspectIdeaLayout } from "./idea-layout.js";
import { isValidUlid } from "../../idea/rules/index.js";

export async function inspectCandidate(root, tree, config, store, bytes, id, { recovering = false } = {}) {
  const path = store.path;
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
  const layout = await inspectIdeaLayout({
    root, config, filesystem, snapshotTree: tree,
    eventOverrides: new Map([[id, { storage: store.storage, bytes }]]),
  });
  if (layout.diagnostics.length) throw new Error(layout.diagnostics.map((d) => d.message).join("; "));
  return layout;
}

export async function resolveIdea(root, tree, config, selector, options = {}) {
  // A canonical identity remains usable for repairing an invalid current projection.
  if (isValidUlid(selector)) return selector;
  const layout = await inspectIdeaLayout({ root, config, snapshotTree: tree, ...options });
  if (layout.diagnostics.length) throw new Error("Use the exact idea ULID while repairing an invalid layout.");
  const idea = layout.ideas.find(({ alias }) => alias === selector);
  if (!idea) throw new Error(`Unknown idea selector: ${selector}`);
  return idea.id;
}
