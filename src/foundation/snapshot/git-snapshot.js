import { isAbsolute, relative, resolve, sep } from "node:path";
import { posix } from "node:path";

import {
  inspectTreeLineage,
  readGitBlob,
  readGitBlobs,
} from "../git/index.js";
import { traceSync } from "../trace/index.js";

const REGULAR_FILE_MODES = new Set(["100644", "100755"]);

function fileSystemError(code, path, message) {
  return Object.assign(new Error(`${message}: ${path}`), { code, path });
}

class SnapshotMetadata {
  constructor(entry, name) {
    this.entry = entry;
    this.name = name;
  }

  isDirectory() {
    return this.entry.type === "tree" && this.entry.mode === "040000";
  }

  isFile() {
    return this.entry.type === "blob"
      && REGULAR_FILE_MODES.has(this.entry.mode);
  }

  isSymbolicLink() {
    return this.entry.type === "blob" && this.entry.mode === "120000";
  }
}

function normalizedRelativePath(root, path) {
  const normalizedRoot = resolve(root);
  const absolutePath = resolve(path);
  const value = relative(normalizedRoot, absolutePath);
  if (
    value === ""
    || (!isAbsolute(value) && value !== ".." && !value.startsWith(`..${sep}`))
  ) {
    return value.split(sep).join("/");
  }
  throw fileSystemError("ENOENT", path, "Snapshot path is outside the root");
}

function childName(path) {
  const separator = path.lastIndexOf("/");
  return separator < 0 ? path : path.slice(separator + 1);
}

export function createGitSnapshotFileSystem({
  gitRoot,
  preload = () => false,
  root = gitRoot,
  tree,
}) {
  return traceSync(
    "snapshot.open",
    {},
    () => {
      const entries = inspectTreeLineage(gitRoot, tree, ".");
      const entriesByPath = new Map(entries.map((entry) => [entry.name, entry]));
      const childrenByPath = new Map();
      for (const entry of entries) {
        const parent = posix.dirname(entry.name);
        const key = parent === "." ? "" : parent;
        const children = childrenByPath.get(key) ?? [];
        children.push(entry);
        childrenByPath.set(key, children);
      }
      const preloadObjects = entries
        .filter((entry) =>
          entry.mode === "120000"
          || (entry.type === "blob" && preload(entry))
        )
        .map(({ object }) => object);
      const blobs = readGitBlobs(gitRoot, preloadObjects);

      async function blob(entry) {
        const cached = blobs.get(entry.object);
        if (cached !== undefined) return cached;
        const loaded = readGitBlob(gitRoot, entry.object);
        blobs.set(entry.object, loaded);
        return loaded;
      }

      async function resolveEntry(path, { followFinal = true } = {}) {
        const requested = normalizedRelativePath(root, path);
        if (requested === "") {
          return {
            entry: {
              mode: "040000",
              name: "",
              object: tree,
              size: null,
              type: "tree",
            },
            path: "",
          };
        }

        let parts = requested.split("/");
        let resolvedParts = [];
        const followed = new Set();
        for (let index = 0; index < parts.length; index += 1) {
          const candidate = [...resolvedParts, parts[index]].join("/");
          const entry = entriesByPath.get(candidate);
          if (entry === undefined) {
            throw fileSystemError("ENOENT", path, "Snapshot path does not exist");
          }
          const shouldFollow = entry.mode === "120000"
            && (followFinal || index < parts.length - 1);
          if (!shouldFollow) {
            resolvedParts.push(parts[index]);
            continue;
          }
          if (followed.has(candidate) || followed.size >= 40) {
            throw fileSystemError("ELOOP", path, "Snapshot symlink cycle");
          }
          followed.add(candidate);
          const target = (await blob(entry)).toString("utf8");
          if (
            target.includes("\0")
            || target.startsWith("/")
            || /^[A-Za-z]:[\\/]/.test(target)
          ) {
            throw fileSystemError(
              "ENOENT",
              path,
              "Snapshot symlink target is outside the root",
            );
          }
          const normalizedTarget = posix.normalize(
            posix.join(posix.dirname(candidate), target.replaceAll("\\", "/")),
          );
          if (
            normalizedTarget === ".."
            || normalizedTarget.startsWith("../")
          ) {
            throw fileSystemError(
              "ENOENT",
              path,
              "Snapshot symlink target is outside the root",
            );
          }
          parts = [
            ...normalizedTarget.split("/").filter(Boolean),
            ...parts.slice(index + 1),
          ];
          resolvedParts = [];
          index = -1;
        }
        const resolvedPath = resolvedParts.join("/");
        return { entry: entriesByPath.get(resolvedPath), path: resolvedPath };
      }

      const filesystem = {
        async lstat(path) {
          const resolved = await resolveEntry(path, { followFinal: false });
          return new SnapshotMetadata(resolved.entry, childName(resolved.path));
        },
        async readFile(path, encoding) {
          const resolved = await resolveEntry(path);
          const metadata = new SnapshotMetadata(
            resolved.entry,
            childName(resolved.path),
          );
          if (!metadata.isFile()) {
            throw fileSystemError("EISDIR", path, "Snapshot path is not a file");
          }
          const content = await blob(resolved.entry);
          return encoding === undefined ? Buffer.from(content) : content.toString(encoding);
        },
        async readdir(path, options = {}) {
          const resolved = await resolveEntry(path);
          const metadata = new SnapshotMetadata(
            resolved.entry,
            childName(resolved.path),
          );
          if (!metadata.isDirectory()) {
            throw fileSystemError("ENOTDIR", path, "Snapshot path is not a directory");
          }
          const children = childrenByPath.get(resolved.path) ?? [];
          if (options.withFileTypes === true) {
            return children.map((entry) =>
              new SnapshotMetadata(entry, childName(entry.name))
            );
          }
          return children.map(({ name }) => childName(name));
        },
        snapshotEntry(path) {
          return entriesByPath.get(path) ?? null;
        },
        snapshotEntries(path) {
          return [...(childrenByPath.get(path) ?? [])];
        },
        async snapshotFile(path) {
          const entry = entriesByPath.get(path);
          if (entry === undefined || entry.type !== "blob") {
            throw fileSystemError("ENOENT", path, "Snapshot blob does not exist");
          }
          return Buffer.from(await blob(entry));
        },
      };
      return filesystem;
    },
  );
}
