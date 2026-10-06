import { lstat, readFile, readdir } from "node:fs/promises";
import { relative, resolve } from "node:path";

import { deriveIdeaState, isValidUlid, parseIdeaStatus } from "../../foundation/idea-model/index.ts";
import { parseIdeaEvents, reduceIdeaEvent, replayIdeaEvents } from "../../foundation/event-codec/index.ts";
import { detectEventFormat } from "../../foundation/event-history/index.ts";
import { readEventStorage } from "../../foundation/event-store/index.ts";
import { EventStream } from "../../foundation/event-store/index.ts";
import { projectEventSnapshot } from "../../foundation/projection-cache/index.ts";
import { inspectTreePaths, worktreeSnapshot } from "../../foundation/git/index.ts";
import { IDEAS_ROOT, ideaPaths } from "../../foundation/coordinates/index.ts";
import {
  type BusinessFileSystem,
  type Diagnostic,
  type EventStore,
  type FileMetadata,
  type ProjectConfig,
  errorMessage,
} from "./business-types.ts";

const DEFAULT_FILESYSTEM = { lstat, readFile, readdir };

export interface LayoutDiagnostic extends Diagnostic {
  level: "error";
  path: string;
}

interface WorldRevision {
  name: string;
  displayName: string;
  path: string;
  documentPath: string;
}

function normalizedEventStatus(status: {
  id: string;
  alias?: string | undefined;
  language?: string | undefined;
  abandoned?: true | undefined;
  approvedRevision?: string | undefined;
  implementationAcceptedRevision?: string | undefined;
  deploymentAcceptedRevision?: string | undefined;
}): ReturnType<typeof parseIdeaStatus> {
  return {
    version: 1,
    id: status.id,
    ...(status.alias === undefined ? {} : { alias: status.alias }),
    ...(status.language === undefined ? {} : { language: status.language }),
    ...(status.abandoned === undefined ? {} : { abandoned: status.abandoned }),
    ...(status.approvedRevision === undefined
      ? {}
      : { approvedRevision: status.approvedRevision }),
    ...(status.implementationAcceptedRevision === undefined
      ? {}
      : { implementationAcceptedRevision: status.implementationAcceptedRevision }),
    ...(status.deploymentAcceptedRevision === undefined
      ? {}
      : { deploymentAcceptedRevision: status.deploymentAcceptedRevision }),
  };
}

export interface ObservedIdea {
  id: string;
  alias?: string;
  path: string;
  relativePath: string;
  revisions: {
    idealRevision: string;
    implementationRevision: string;
    deploymentRevision: string;
  };
  idealRevision: string;
  implementationRevision: string;
  deploymentRevision: string;
  state: string;
  status: ReturnType<typeof parseIdeaStatus>;
  statusPath: string;
  ledgerPath: string;
  worlds: {
    idealRevision: WorldRevision;
    implementationRevision: WorldRevision;
    deploymentRevision: WorldRevision;
  };
}

export interface IdeaLayout {
  diagnostics: LayoutDiagnostic[];
  ideas: ObservedIdea[];
}

function displayPath(root: string, path: string): string {
  return relative(root, path).replaceAll("\\", "/");
}

function error(code: string, path: string, message: string, remediation: string): LayoutDiagnostic {
  return { code, level: "error", path, message, remediation };
}

async function metadata(path: string, filesystem: BusinessFileSystem): Promise<FileMetadata | null> {
  try {
    return await filesystem.lstat(path);
  } catch (caught) {
    if (caught instanceof Error && "code" in caught && caught.code === "ENOENT") return null;
    throw caught;
  }
}

async function requireDirectory(
  root: string,
  path: string,
  diagnostics: LayoutDiagnostic[],
  filesystem: BusinessFileSystem,
): Promise<boolean> {
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

async function requireDocument(
  root: string,
  path: string,
  diagnostics: LayoutDiagnostic[],
  filesystem: BusinessFileSystem,
): Promise<boolean> {
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

async function requireLedger(
  root: string,
  path: string,
  diagnostics: LayoutDiagnostic[],
  filesystem: BusinessFileSystem,
): Promise<boolean> {
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

async function rejectSymlinks(
  root: string,
  path: string,
  diagnostics: LayoutDiagnostic[],
  filesystem: BusinessFileSystem,
): Promise<void> {
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

function objectIdLength(tree: string): number {
  if (/^[0-9a-f]{40}$/.test(tree)) return 40;
  if (/^[0-9a-f]{64}$/.test(tree)) return 64;
  throw new Error(`Unsupported Git tree object ID: ${tree}`);
}

function requiredTree(
  objects: Map<string, { object: string | null; type: string }>,
  path: string,
): string {
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
}: {
  config: ProjectConfig | null;
  filesystem?: BusinessFileSystem | undefined;
  root: string;
  gitRoot?: string | undefined;
  snapshotTree?: string | undefined;
  eventOverrides?: Map<string, EventStore> | undefined;
  projectedEvents?: boolean | undefined;
  projectedRequests?: Map<string, Parameters<typeof reduceIdeaEvent>[1]> | undefined;
}): Promise<IdeaLayout> {
  const diagnostics: LayoutDiagnostic[] = [];
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
        errorMessage(caught),
        "Run Silvermoon inside a Git repository with a supported object format.",
      )],
      ideas: [],
    };
  }

  const aliases = new Map<string, string>();
  const ideas: ObservedIdea[] = [];
  const caseNames = new Map<string, string>();
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
  const snapshotEntry = filesystem.snapshotEntry;
  let worldObjects;
  try {
    worldObjects = typeof snapshotEntry === "function"
      ? new Map(worldPaths.map((path) => {
          const entry = snapshotEntry(path);
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
        errorMessage(caught),
        "Ensure every world can be represented as a Git tree.",
      )],
      ideas: [],
    };
  }
  let legacyEvents = false;
  const useProjections = config?.version === 2 && projectedEvents && !eventOverrides
    && typeof snapshotEntry === "function"
    && [...ideaIds].every((id) => snapshotEntry(ideaPaths(id).eventsDirectory)?.type === "tree");
  if (config?.version === 2 && !useProjections) {
    try {
      const overrides = eventOverrides && new Map([...eventOverrides].map(([id, store]) => [
        store.storage === "segmented" ? ideaPaths(id).eventsDirectory : ideaPaths(id).legacyEventsPath,
        store.bytes,
      ]));
      legacyEvents = await detectEventFormat({
        root: gitRoot,
        tree: resolvedSnapshotTree,
        ...(overrides === undefined ? {} : { overrides }),
      }) === "legacy";
    } catch (caught) {
      return {
        diagnostics: [error(
          "idea.events.format-invalid",
          IDEAS_ROOT,
          errorMessage(caught),
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
        if (
          typeof filesystem.snapshotEntry !== "function"
          || typeof filesystem.snapshotEntries !== "function"
          || typeof filesystem.snapshotFile !== "function"
        ) {
          throw new TypeError("Projected event inspection requires snapshot filesystem capabilities.");
        }
        const projected = await projectEventSnapshot(
          gitRoot,
          entry.name,
          paths,
          options,
          {
            lstat: filesystem.lstat,
            readFile: filesystem.readFile,
            readdir: filesystem.readdir,
            snapshotEntry: filesystem.snapshotEntry,
            snapshotEntries: filesystem.snapshotEntries,
            snapshotFile: filesystem.snapshotFile,
          },
        );
        const request = projectedRequests?.get(entry.name);
        const reduced = request ? reduceIdeaEvent(projected.state, request, options) : null;
        if (reduced && !reduced.ok && "sequence" in reduced && "code" in reduced) {
          throw new Error(`Event ${reduced.sequence}: ${reduced.code}`);
        }
        const reducedState = reduced && "state" in reduced ? reduced.state : projected.state;
        status = normalizedEventStatus(reducedState.status);
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
        if (!result.ok && "sequence" in result && "code" in result) {
          throw new Error(`Event ${result.sequence}: ${result.code}`);
        }
        if (!("state" in result)) throw new Error("Event replay did not return state.");
        status = normalizedEventStatus(result.state.status);
      } else {
        status = parseIdeaStatus(
          (await filesystem.readFile(resolve(root, statePath))).toString("utf8"),
          options,
        );
      }
    } catch (caught) {
      diagnostics.push(error(
        "idea.status.invalid",
        statePath,
        errorMessage(caught),
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
        errorMessage(caught),
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
    const idea: ObservedIdea = {
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
