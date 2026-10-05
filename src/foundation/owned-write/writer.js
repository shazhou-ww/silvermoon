import { lstat, mkdir, readFile, rm, rmdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { isValidUlid } from "../idea-model/index.js";
import { IDEAS_ROOT, ideaPaths } from "../coordinates/index.js";
import { buildIdeaScaffold } from "../scaffold-plan/index.js";

const MAX_ID_ATTEMPTS = 32;

export async function pathExists(path, inspect) {
  try {
    await inspect(path);
    return true;
  } catch (caught) {
    if (caught.code === "ENOENT") return false;
    throw caught;
  }
}

export async function removeOwnedFile(path, expected, read, remove) {
  let current;
  try {
    current = await read(path);
  } catch (caught) {
    if (caught.code === "ENOENT") return { path, status: "missing" };
    throw caught;
  }
  const expectedBytes = Buffer.from(expected);
  if (current.equals(expectedBytes)) {
    await remove(path, { force: true });
    return { path, status: "removed" };
  }
  return { path, status: "preserved-modified" };
}

export async function removeCreatedDirectories(created, removeDirectory) {
  const results = [];
  for (const path of [...created].reverse()) {
    try {
      await removeDirectory(path);
      results.push({ path, status: "removed" });
    } catch (caught) {
      results.push({ path, status: "preserved", error: caught.message });
    }
  }
  return results;
}

export async function ensureDirectoryPath(root, relativePath, operations) {
  const created = [];
  let current = root;
  try {
    for (const segment of relativePath.split("/")) {
      current = resolve(current, segment);
      let metadata;
      try {
        metadata = await operations.inspect(current);
      } catch (caught) {
        if (caught.code !== "ENOENT") throw caught;
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
        if (caught.code !== "EEXIST") throw caught;
        metadata = await operations.inspect(current);
        if (!metadata.isDirectory() || metadata.isSymbolicLink()) throw caught;
      }
    }
    return created;
  } catch (caught) {
    caught.createdDirectories = created;
    throw caught;
  }
}

export function cleanupSummary(results) {
  const preserved = results.filter(({ status }) => status.startsWith("preserved"));
  return preserved.length === 0
    ? "All paths still owned by this operation were removed."
    : `Preserved ${preserved.length} path(s) because they changed or could not be removed: `
    + preserved.map(({ path }) => path).join(", ");
}

export function cleanupResult(results) {
  return {
    removed: results.filter(({ status }) => status === "removed").length,
    preserved: results.filter(({ status }) => status.startsWith("preserved")).length,
    items: results,
  };
}

export function withCleanupPlan(caught, cleanupPlan) {
  const error = caught instanceof Error ? caught : new Error(String(caught));
  error.cleanupPlan = cleanupPlan;
  return error;
}

export async function cleanupScaffold(cleanupPlan, operations) {
  const read = operations.readFile ?? readFile;
  const remove = operations.rm ?? rm;
  const removeDirectory = operations.rmdir ?? rmdir;
  const results = [];
  for (const [path, source] of [...cleanupPlan.cleanupFiles].reverse()) {
    try {
      results.push(await removeOwnedFile(path, source, read, remove));
    } catch (caught) {
      results.push({
        path,
        status: "preserved",
        error: caught.message,
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
}) {
  const inspect = operations.lstat ?? lstat;
  const makeDirectory = operations.mkdir ?? mkdir;
  const write = operations.writeFile ?? writeFile;
  const fileOperations = {
    inspect,
    makeDirectory,
  };
  let rootDirectories;
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
      rootDirectories: caught.createdDirectories ?? [],
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
      id, canonicalLanguage, contentLanguage, formatVersion,
    });
    const createdDirectories = [];
    const cleanupFiles = [];
    let collisionPath = null;
    try {
      for (const relativePath of directoryPaths) {
        const absolutePath = resolve(repositoryRoot, relativePath);
        await makeDirectory(absolutePath);
        createdDirectories.push(absolutePath);
      }
      for (const [relativePath, source] of files) {
        const absolutePath = resolve(repositoryRoot, relativePath);
        const cleanup = [absolutePath, source];
        cleanupFiles.push(cleanup);
        try {
          await write(absolutePath, source, { flag: "wx" });
        } catch (caught) {
          if (caught.code === "EEXIST") {
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
