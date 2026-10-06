import { lstat, mkdir, readFile, rm, rmdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { isValidUlid } from "../idea-model/index.ts";
import { IDEAS_ROOT, ideaPaths } from "../coordinates/index.ts";
import { buildIdeaScaffold } from "../scaffold-plan/index.ts";

const MAX_ID_ATTEMPTS = 32;

type FileSource = string | Uint8Array<ArrayBufferLike>;
type CleanupFile = readonly [path: string, source: FileSource];
type CleanupPlan = {
  cleanupFiles: CleanupFile[];
  collisionPath: string | null;
  createdDirectories: string[];
  rootDirectories: string[];
};
type CleanupItem = {
  path: string;
  status: "missing" | "preserved" | "preserved-existing" | "preserved-modified" | "removed";
  error?: string;
};
type DirectoryMetadata = {
  isDirectory(): boolean;
  isSymbolicLink(): boolean;
};
type ScaffoldOperations = {
  lstat?: typeof lstat;
  mkdir?: typeof mkdir;
  readFile?: typeof readFile;
  rm?: typeof rm;
  rmdir?: typeof rmdir;
  writeFile?: typeof writeFile;
};

function hasErrorCode(caught: unknown, code: string) {
  return caught instanceof Error && "code" in caught && caught.code === code;
}

function errorMessage(caught: unknown) {
  return caught instanceof Error ? caught.message : String(caught);
}

export async function pathExists(
  path: string,
  inspect: (path: string) => Promise<DirectoryMetadata>,
) {
  try {
    await inspect(path);
    return true;
  } catch (caught) {
    if (hasErrorCode(caught, "ENOENT")) return false;
    throw caught;
  }
}

export async function removeOwnedFile(
  path: string,
  expected: FileSource,
  read: (path: string) => Promise<Buffer>,
  remove: (path: string, options: { force: boolean }) => Promise<void>,
) {
  let current: Buffer;
  try {
    current = await read(path);
  } catch (caught) {
    if (hasErrorCode(caught, "ENOENT")) {
      return { path, status: "missing" as const };
    }
    throw caught;
  }
  const expectedBytes = Buffer.from(expected);
  if (current.equals(expectedBytes)) {
    await remove(path, { force: true });
    return { path, status: "removed" as const };
  }
  return { path, status: "preserved-modified" as const };
}

export async function removeCreatedDirectories(
  created: readonly string[],
  removeDirectory: (path: string) => Promise<void>,
) {
  const results: CleanupItem[] = [];
  for (const path of [...created].reverse()) {
    try {
      await removeDirectory(path);
      results.push({ path, status: "removed" });
    } catch (caught) {
      results.push({ path, status: "preserved", error: errorMessage(caught) });
    }
  }
  return results;
}

export async function ensureDirectoryPath(
  root: string,
  relativePath: string,
  operations: {
    inspect: (path: string) => Promise<DirectoryMetadata>;
    makeDirectory: (path: string) => Promise<unknown>;
  },
) {
  const created: string[] = [];
  let current = root;
  try {
    for (const segment of relativePath.split("/")) {
      current = resolve(current, segment);
      let metadata;
      try {
        metadata = await operations.inspect(current);
      } catch (caught) {
        if (!hasErrorCode(caught, "ENOENT")) throw caught;
      }
      if (metadata) {
        if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
          throw new Error(`Silvermoon path segment is not a regular directory: ${current}`);
        }
        continue;
      }
      try {
        await operations.makeDirectory(current);
        created.push(current);
      } catch (caught) {
        if (!hasErrorCode(caught, "EEXIST")) throw caught;
        metadata = await operations.inspect(current);
        if (!metadata.isDirectory() || metadata.isSymbolicLink()) throw caught;
      }
    }
    return created;
  } catch (caught) {
    throw Object.assign(
      caught instanceof Error ? caught : new Error(String(caught)),
      { createdDirectories: created },
    );
  }
}

export function cleanupSummary(results: readonly CleanupItem[]) {
  const preserved = results.filter(({ status }) => status.startsWith("preserved"));
  return preserved.length === 0
    ? "All paths still owned by this operation were removed."
    : `Preserved ${preserved.length} path(s) because they changed or could not be removed: `
    + preserved.map(({ path }) => path).join(", ");
}

export function cleanupResult(results: CleanupItem[]) {
  return {
    removed: results.filter(({ status }) => status === "removed").length,
    preserved: results.filter(({ status }) => status.startsWith("preserved")).length,
    items: results,
  };
}

export function withCleanupPlan(caught: unknown, cleanupPlan: CleanupPlan) {
  const error = caught instanceof Error ? caught : new Error(String(caught));
  return Object.assign(error, { cleanupPlan });
}

export async function cleanupScaffold(
  cleanupPlan: CleanupPlan,
  operations: ScaffoldOperations = {},
) {
  const read = operations.readFile ?? readFile;
  const remove = operations.rm ?? rm;
  const removeDirectory = operations.rmdir ?? rmdir;
  const results: CleanupItem[] = [];
  for (const [path, source] of [...cleanupPlan.cleanupFiles].reverse()) {
    try {
      results.push(await removeOwnedFile(path, source, read, remove));
    } catch (caught) {
      results.push({
        path,
        status: "preserved",
        error: errorMessage(caught),
      });
    }
  }
  results.push(...await removeCreatedDirectories(
    cleanupPlan.createdDirectories,
    removeDirectory,
  ));
  if (cleanupPlan.collisionPath) {
    results.push({
      path: cleanupPlan.collisionPath,
      status: "preserved-existing",
    });
  }
  results.push(...await removeCreatedDirectories(
    cleanupPlan.rootDirectories,
    removeDirectory,
  ));
  return cleanupResult(results);
}

export async function createScaffold({
  canonicalLanguage,
  contentLanguage,
  formatVersion,
  generateId,
  operations,
  repositoryRoot,
}: {
  canonicalLanguage?: string;
  contentLanguage: string;
  formatVersion: number;
  generateId: () => string | Promise<string>;
  operations?: ScaffoldOperations;
  repositoryRoot: string;
}) {
  operations ??= {};
  const inspect = operations.lstat ?? lstat;
  const makeDirectory = operations.mkdir ?? mkdir;
  const write = operations.writeFile ?? writeFile;
  const fileOperations = {
    inspect,
    makeDirectory,
  };
  let rootDirectories: string[];
  try {
    rootDirectories = await ensureDirectoryPath(
      repositoryRoot,
      IDEAS_ROOT,
      fileOperations,
    );
  } catch (caught) {
    throw withCleanupPlan(caught, {
      cleanupFiles: [],
      collisionPath: null,
      createdDirectories: [],
      rootDirectories: caught instanceof Error
          && "createdDirectories" in caught
          && Array.isArray(caught.createdDirectories)
        ? caught.createdDirectories.filter((path): path is string => typeof path === "string")
        : [],
    });
  }

  for (let attempt = 0; attempt < MAX_ID_ATTEMPTS; attempt += 1) {
    let id;
    let paths;
    let folder;
    try {
      id = await generateId();
      if (!isValidUlid(id)) {
        throw new Error(`Generated idea id is not a canonical ULID: ${id}`);
      }
      paths = ideaPaths(id);
      folder = resolve(repositoryRoot, paths.ideaPath);
      if (await pathExists(folder, inspect)) continue;
    } catch (caught) {
      throw withCleanupPlan(caught, {
        cleanupFiles: [],
        collisionPath: null,
        createdDirectories: [],
        rootDirectories,
      });
    }

    const { directoryPaths, files } = buildIdeaScaffold({
      id,
      ...(canonicalLanguage === undefined ? {} : { canonicalLanguage }),
      contentLanguage,
      formatVersion,
    });
    const createdDirectories: string[] = [];
    const cleanupFiles: CleanupFile[] = [];
    let collisionPath: string | null = null;
    try {
      for (const relativePath of directoryPaths) {
        const absolutePath = resolve(repositoryRoot, relativePath);
        await makeDirectory(absolutePath);
        createdDirectories.push(absolutePath);
      }
      for (const file of files) {
        const [relativePath, source] = file;
        if (typeof relativePath !== "string" || typeof source !== "string") {
          throw new Error("Invalid scaffold file plan.");
        }
        const absolutePath = resolve(repositoryRoot, relativePath);
        const cleanup: CleanupFile = [absolutePath, source];
        cleanupFiles.push(cleanup);
        try {
          await write(absolutePath, source, { flag: "wx" });
        } catch (caught) {
          if (hasErrorCode(caught, "EEXIST")) {
            cleanupFiles.pop();
            collisionPath = absolutePath;
          }
          throw caught;
        }
      }
      return {
        createdIdea: {
          id,
          path: paths.ideaPath,
          state: "preparing",
        },
        paths,
      };
    } catch (caught) {
      throw withCleanupPlan(caught, {
        cleanupFiles,
        collisionPath,
        createdDirectories,
        rootDirectories,
      });
    }
  }

  throw withCleanupPlan(
    new Error(`Could not allocate a unique idea id after ${MAX_ID_ATTEMPTS} attempts.`),
    {
      cleanupFiles: [],
      collisionPath: null,
      createdDirectories: [],
      rootDirectories,
    },
  );
}
