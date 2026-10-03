import { lstat, readFile, readdir } from "node:fs/promises";
import { relative, resolve } from "node:path";

import { deriveIdeaState, isValidUlid, parseIdeaStatus } from "../../idea/rules/index.js";
import { parseIdeaEvents, reduceIdeaEvent, replayIdeaEvents } from "../../events/rules/index.js";
import { detectEventFormat } from "../../events/index.js";
import { readEventStorage } from "../../events/index.js";
import { EventStream } from "../../events/index.js";
import { projectEventSnapshot } from "../../events/index.js";
import { inspectTreePaths, worktreeSnapshot } from "../../repository/index.js";
import { IDEAS_ROOT, ideaPaths } from "../../project/rules/index.js";

const DEFAULT_FILESYSTEM = { lstat, readFile, readdir };

function displayPath(root, path) {
  return relative(root, path).replaceAll("\\", "/");
}

function error(code, path, message, remediation) {
  return { code, level: "error", path, message, remediation };
}

async function metadata(path, filesystem) {
  try {
    return await filesystem.lstat(path);
  } catch (caught) {
    if (caught.code === "ENOENT") return null;
    throw caught;
  }
}

async function requireDirectory(root, path, diagnostics, filesystem) {
  const absolute = resolve(root, path);
  const value = await metadata(absolute, filesystem);
  if (!value || !value.isDirectory() || value.isSymbolicLink()) {
    diagnostics.push(error(
      "idea.world.invalid-directory",
      path,
      `Required world path must be a repository-owned regular directory: ${path}`,
      `Create ${path} as a regular directory without symlinks.`,
    ));
    return false;
  }
  return true;
}

async function requireDocument(root, path, diagnostics, filesystem) {
  const absolute = resolve(root, path);
  const value = await metadata(absolute, filesystem);
  if (!value || !value.isFile() || value.isSymbolicLink()) {
    diagnostics.push(error(
      "idea.world.missing-document",
      path,
      `Required world entry must be a repository-owned regular file: ${path}`,
      `Create ${path} as a regular file without symlinks.`,
    ));
    return false;
  }
  return true;
}

async function requireLedger(root, path, diagnostics, filesystem) {
  const value = await metadata(resolve(root, path), filesystem);
  if (!value) {
    diagnostics.push(error(
      "idea.ledger.missing-file",
      path,
      `Required idea ledger does not exist: ${path}`,
      `Create ${path} as a repository-owned regular file.`,
    ));
    return false;
  }
  if (!value.isFile() || value.isSymbolicLink()) {
    diagnostics.push(error(
      "idea.ledger.invalid-file",
      path,
      `Required idea ledger must be a repository-owned regular file: ${path}`,
      `Replace ${path} with a regular file.`,
    ));
    return false;
  }
  return true;
}

async function rejectSymlinks(root, path, diagnostics, filesystem) {
  const absolute = resolve(root, path);
  for (
    const entry of await filesystem.readdir(absolute, { withFileTypes: true })
  ) {
    const entryPath = `${path}/${entry.name}`;
    const value = await filesystem.lstat(resolve(root, entryPath));
    if (value.isSymbolicLink()) {
      diagnostics.push(error(
        "idea.world.symlink",
        entryPath,
        `World content must not use symlinks: ${entryPath}`,
        "Replace the symlink with repository-owned regular content.",
      ));
      continue;
    }
    if (value.isDirectory()) {
      await rejectSymlinks(root, entryPath, diagnostics, filesystem);
    }
  }
}

function objectIdLength(tree) {
  if (/^[0-9a-f]{40}$/.test(tree)) return 40;
  if (/^[0-9a-f]{64}$/.test(tree)) return 64;
  throw new Error(`Unsupported Git tree object ID: ${tree}`);
}

function requiredTree(objects, path) {
  const inspected = objects.get(path);
  if (!inspected || inspected.type !== "tree" || inspected.object === null) {
    throw new Error(`${path} does not resolve to a Git tree`);
  }
  return inspected.object;
}

export async function inspectIdeaLayout({
  config,
  filesystem = DEFAULT_FILESYSTEM,
  root,
  gitRoot = root,
  snapshotTree,
  eventOverrides,
  projectedEvents = false,
  projectedRequests,
}) {
  const diagnostics = [];
  const ideasRoot = resolve(root, IDEAS_ROOT);
  const ideasRootMetadata = await metadata(ideasRoot, filesystem);
  if (!ideasRootMetadata) {
    return {
      diagnostics: [error(
        "layout.ideas.missing",
        IDEAS_ROOT,
        `Silvermoon ideas directory does not exist: ${IDEAS_ROOT}`,
        `Create ${IDEAS_ROOT} as a repository-owned directory.`,
      )],
      ideas: [],
    };
  }
  if (!ideasRootMetadata.isDirectory() || ideasRootMetadata.isSymbolicLink()) {
    return {
      diagnostics: [error(
        "layout.ideas.invalid",
        IDEAS_ROOT,
        "The Silvermoon ideas path must be a repository-owned regular directory.",
        `Replace ${IDEAS_ROOT} with a regular directory.`,
      )],
      ideas: [],
    };
  }

  let resolvedSnapshotTree;
  let repositoryObjectIdLength;
  try {
    resolvedSnapshotTree = snapshotTree
      ?? worktreeSnapshot(gitRoot, { paths: [IDEAS_ROOT] }).tree;
    repositoryObjectIdLength = objectIdLength(resolvedSnapshotTree);
  } catch (caught) {
    return {
      diagnostics: [error(
        "git.object-format.unavailable",
        IDEAS_ROOT,
        caught.message,
        "Run Silvermoon inside a Git repository with a supported object format.",
      )],
      ideas: [],
    };
  }

  const aliases = new Map();
  const ideas = [];
  const caseNames = new Map();
  const entries = (
    await filesystem.readdir(ideasRoot, { withFileTypes: true })
  )
    .sort((left, right) => left.name.localeCompare(right.name));
  const ideaIds = new Set(
    entries.filter((entry) => isValidUlid(entry.name)).map((entry) => entry.name),
  );
  const worldPaths = [...ideaIds].flatMap((id) => {
    const paths = ideaPaths(id);
    return [paths.idealPath, paths.innerPath, paths.outerPath];
  });
  let worldObjects;
  try {
    worldObjects = typeof filesystem.snapshotEntry === "function"
      ? new Map(worldPaths.map((path) => {
          const entry = filesystem.snapshotEntry(path);
          return [
            path,
            {
              object: entry?.object ?? null,
              type: entry?.type ?? "missing",
            },
          ];
        }))
      : inspectTreePaths(gitRoot, resolvedSnapshotTree, worldPaths);
  } catch (caught) {
    return {
      diagnostics: [error(
        "idea.revision.unavailable",
        IDEAS_ROOT,
        caught.message,
        "Ensure every world can be represented as a Git tree.",
      )],
      ideas: [],
    };
  }
  let legacyEvents = false;
  const useProjections = config?.version === 2 && projectedEvents && !eventOverrides
    && typeof filesystem.snapshotEntry === "function"
    && [...ideaIds].every((id) => filesystem.snapshotEntry(ideaPaths(id).eventsDirectory)?.type === "tree");
  if (config?.version === 2 && !useProjections) {
    try {
      const overrides = eventOverrides && new Map([...eventOverrides].map(([id, store]) => [
        store.storage === "segmented" ? ideaPaths(id).eventsDirectory : ideaPaths(id).legacyEventsPath,
        store.bytes,
      ]));
      legacyEvents = await detectEventFormat({ root: gitRoot, tree: resolvedSnapshotTree, overrides }) === "legacy";
    } catch (caught) {
      return {
        diagnostics: [error(
          "idea.events.format-invalid",
          IDEAS_ROOT,
          caught.message,
          "Inspect the source repository's historical event format and preserve all logs.",
        )],
        ideas: [],
      };
    }
  }
  for (const entry of entries) {
    const folderPath = resolve(ideasRoot, entry.name);
    const folderMetadata = await filesystem.lstat(folderPath);
    const relativePath = displayPath(root, folderPath);
    const folded = entry.name.toUpperCase();
    const existingCase = caseNames.get(folded);
    if (existingCase && existingCase !== entry.name) {
      diagnostics.push(error(
        "idea.id.case-collision",
        relativePath,
        `Idea identities collide by case: ${existingCase} and ${entry.name}.`,
        "Keep exactly one canonical uppercase ULID identity.",
      ));
    } else {
      caseNames.set(folded, entry.name);
    }
    if (!isValidUlid(entry.name)) {
      diagnostics.push(error(
        "idea.id.invalid",
        relativePath,
        `Idea folders must use canonical ULID identities: ${entry.name}`,
        "Rename the folder to one canonical uppercase ULID.",
      ));
      continue;
    }
    if (!folderMetadata.isDirectory() || folderMetadata.isSymbolicLink()) {
      diagnostics.push(error(
        "idea.folder.invalid",
        relativePath,
        "Idea must be a repository-owned regular directory.",
        "Replace it with a regular directory.",
      ));
      continue;
    }

    const paths = ideaPaths(entry.name);
    const eventFormat = config?.version === 2;
    const segmented = eventFormat && await metadata(resolve(root, paths.eventsDirectory), filesystem);
    const stateName = eventFormat ? segmented ? "events" : "events.jsonl" : "status.yaml";
    const statePath = eventFormat ? segmented ? paths.eventsDirectory : paths.legacyEventsPath : paths.statusPath;
    const children = (
      await filesystem.readdir(folderPath, { withFileTypes: true })
    )
      .sort((left, right) => left.name.localeCompare(right.name));
    for (const child of children) {
      if (
        child.name === stateName ||
        child.name === "ledger.md" ||
        child.name === "outer"
      ) continue;
      diagnostics.push(error(
        child.name.toLowerCase().includes("status")
          ? "idea.status.unexpected-file"
          : "idea.entry.unexpected",
        `${paths.ideaPath}/${child.name}`,
        `Unexpected entry at the idea root: ${child.name}`,
        `Keep only ${stateName}, ledger.md, and outer/ at the idea root; put supporting files in their world.`,
      ));
    }
    await requireLedger(root, paths.ledgerPath, diagnostics, filesystem);
    const requiredDirectories = [
      paths.outerPath,
      paths.innerPath,
      paths.idealPath,
    ];
    const requiredDocuments = [
      paths.deploymentDocumentPath,
      paths.implementationDocumentPath,
      paths.ideaDocumentPath,
    ];
    const validDirectories = (await Promise.all(
      requiredDirectories.map((path) =>
        requireDirectory(root, path, diagnostics, filesystem)
      ),
    )).every(Boolean);
    const validDocuments = (await Promise.all(
      requiredDocuments.map((path) =>
        requireDocument(root, path, diagnostics, filesystem)
      ),
    )).every(Boolean);
    if (validDirectories) {
      await rejectSymlinks(
        root,
        paths.outerPath,
        diagnostics,
        filesystem,
      );
    }

    const statusMetadata = await metadata(
      resolve(root, statePath),
      filesystem,
    );
    if (!statusMetadata || !(segmented ? statusMetadata.isDirectory() : statusMetadata.isFile())
      || statusMetadata.isSymbolicLink()) {
      diagnostics.push(error(
        "idea.status.invalid-file",
        statePath,
        `Idea state must be a repository-owned regular ${segmented ? "directory" : "file"} named ${stateName}.`,
        `Restore ${statePath} from its authoritative history.`,
      ));
      continue;
    }

    let status;
    try {
      const options = { objectIdLength: repositoryObjectIdLength, legacy: legacyEvents };
      if (eventFormat && useProjections) {
        const projected = await projectEventSnapshot(gitRoot, entry.name, paths, options, filesystem);
        const request = projectedRequests?.get(entry.name);
        const reduced = request ? reduceIdeaEvent(projected.state, request, options) : null;
        if (reduced && !reduced.ok) throw new Error(`Event ${reduced.sequence}: ${reduced.code}`);
        status = { version: 1, ...(reduced?.state ?? projected.state).status };
      } else if (eventFormat) {
        const store = eventOverrides?.get(entry.name) ?? await readEventStorage(root, paths, {
          ...options, allowSingleFile: config.primaryRepository === "https://github.com/shazhou-ww/silvermoon.git",
        }, filesystem);
        if (store.storage === "segmented") EventStream.fromBytes(store.bytes, options);
        if (store.storage === "segmented" && store.entries) EventStream.fromSegments(store.entries, options);
        const events = parseIdeaEvents(
          store.bytes, options,
        );
        const result = replayIdeaEvents(entry.name, events, options);
        if (!result.ok) throw new Error(`Event ${result.sequence}: ${result.code}`);
        status = { version: 1, ...result.state.status };
      } else {
        status = parseIdeaStatus(
          await filesystem.readFile(resolve(root, statePath), "utf8"), options,
        );
      }
    } catch (caught) {
      diagnostics.push(error(
        "idea.status.invalid",
        statePath,
        caught.message,
        eventFormat
          ? "Inspect the primary baseline, then use the event command to revise an owned candidate or repair a reduction-failed baseline."
          : "Rewrite status.yaml in canonical form.",
      ));
      continue;
    }
    if (status.id !== entry.name) {
      diagnostics.push(error(
        "idea.status.id-mismatch",
        `${statePath}#id`,
        `Status id ${status.id} does not match ${entry.name}.`,
        "Use the same canonical ULID in the folder and status id.",
      ));
    }
    if (status.alias !== undefined) {
      if (ideaIds.has(status.alias)) {
        diagnostics.push(error(
          "idea.alias.id-collision",
          `${statePath}#alias`,
          `Alias ${status.alias} collides with an idea ULID.`,
          "Choose an alias that is distinct from every idea ULID.",
        ));
      }
      const aliasOwner = aliases.get(status.alias);
      if (aliasOwner) {
        diagnostics.push(error(
          "idea.alias.duplicate",
          `${statePath}#alias`,
          `Alias ${status.alias} is shared by ${aliasOwner} and ${entry.name}.`,
          "Assign a unique exact case-sensitive alias.",
        ));
      } else {
        aliases.set(status.alias, entry.name);
      }
    }
    if (
      !validDirectories ||
      !validDocuments ||
      diagnostics.some(({ code, path }) =>
        code === "idea.world.symlink" && path.startsWith(`${paths.outerPath}/`)
      )
    ) continue;

    let revisions;
    try {
      revisions = {
        idealRevision: requiredTree(worldObjects, paths.idealPath),
        implementationRevision: requiredTree(worldObjects, paths.innerPath),
        deploymentRevision: requiredTree(worldObjects, paths.outerPath),
      };
    } catch (caught) {
      diagnostics.push(error(
        "idea.revision.unavailable",
        paths.ideaPath,
        caught.message,
        "Ensure every world can be represented as a Git tree.",
      ));
      continue;
    }

    const worlds = {
      idealRevision: {
        name: "Ideal World",
        displayName: "理想世界",
        path: paths.idealPath,
        documentPath: paths.ideaDocumentPath,
      },
      implementationRevision: {
        name: "Inner World",
        displayName: "主体世界",
        path: paths.innerPath,
        documentPath: paths.implementationDocumentPath,
      },
      deploymentRevision: {
        name: "Outer World",
        displayName: "现实世界",
        path: paths.outerPath,
        documentPath: paths.deploymentDocumentPath,
      },
    };
    const idea = {
      id: entry.name,
      path: folderPath,
      relativePath: paths.ideaPath,
      revisions,
      ...revisions,
      state: deriveIdeaState(revisions, status),
      status,
      statusPath: statePath,
      ledgerPath: paths.ledgerPath,
      worlds,
    };
    if (status.alias !== undefined) idea.alias = status.alias;
    ideas.push(idea);
  }

  return { diagnostics, ideas };
}
