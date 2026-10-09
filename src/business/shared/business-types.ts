import type { EventStore as FoundationEventStore } from "../../foundation/event-store/storage.ts";
import type {
  Observation,
  Problem,
  RepositoryBlockedObservation,
  ProjectReadyObservation,
} from "../../foundation/report/types.ts";
import { traceAsync } from "../../foundation/trace/index.ts";

export interface Diagnostic {
  code: string;
  level: string;
  message: string;
  remediation: string;
  path?: string;
}

export interface ProjectConfig {
  version: 1 | 2;
  primaryRepository: string;
  primaryBranch: string;
  preferredLanguage?: string;
}

export interface IdeaPaths {
  ideaPath: string;
  statusPath: string;
  eventsPath: string;
  ledgerPath: string;
  outerPath: string;
  innerPath: string;
  idealPath: string;
  deploymentDocumentPath: string;
  implementationDocumentPath: string;
  ideaDocumentPath: string;
}

export interface EventOptions {
  objectIdLength: number;
  legacy?: boolean;
}

export type EventStore = FoundationEventStore;

export interface SnapshotEntry {
  type: string;
  mode: string;
  object: string;
  size: number | null;
  name: string;
}

export interface FileMetadata {
  isDirectory(): boolean;
  isFile(): boolean;
  isSymbolicLink(): boolean;
}

export interface DirectoryEntry {
  name: string;
}

export interface BusinessFileSystem {
  lstat(path: string): Promise<FileMetadata>;
  readFile(path: string): Promise<Buffer>;
  readdir(path: string): Promise<string[]>;
  readdir(path: string, options: { withFileTypes: true }): Promise<DirectoryEntry[]>;
  snapshotEntry?(path: string): SnapshotEntry | null | undefined;
  snapshotEntries?(path: string): SnapshotEntry[];
  snapshotFile?(path: string): Promise<Buffer>;
}

export interface SnapshotBusinessFileSystem extends BusinessFileSystem {
  snapshotEntry(path: string): SnapshotEntry | null | undefined;
  snapshotEntries(path: string): SnapshotEntry[];
  snapshotFile(path: string): Promise<Buffer>;
}

export type GitSnapshotFileSystem = ReturnType<
  typeof import("../../foundation/snapshot/index.ts").createGitSnapshotFileSystem
>;

export function asBusinessFileSystem(
  filesystem: GitSnapshotFileSystem,
): BusinessFileSystem {
  function readdir(path: string): Promise<string[]>;
  function readdir(
    path: string,
    options: { withFileTypes: true },
  ): Promise<DirectoryEntry[]>;
  async function readdir(
    path: string,
    options?: { withFileTypes: true },
  ): Promise<string[] | DirectoryEntry[]> {
    const entries = await filesystem.readdir(path, options);
    if (options === undefined) {
      const names: string[] = [];
      for (const entry of entries) {
        if (typeof entry !== "string") {
          throw new TypeError("Snapshot filesystem returned non-string directory entries.");
        }
        names.push(entry);
      }
      return names;
    }
    const metadata: DirectoryEntry[] = [];
    for (const entry of entries) {
      if (
        typeof entry !== "object" || entry === null
        || !("name" in entry) || typeof entry.name !== "string"
      ) {
        throw new TypeError("Snapshot filesystem returned invalid directory metadata.");
      }
      metadata.push(entry);
    }
    return metadata;
  }

  return {
    lstat: (path) => filesystem.lstat(path),
    readFile: async (path) => {
      const value = await filesystem.readFile(path);
      if (!Buffer.isBuffer(value)) {
        throw new TypeError("Snapshot filesystem returned non-buffer file content.");
      }
      return value;
    },
    readdir,
    snapshotEntry: (path) => filesystem.snapshotEntry(path),
    snapshotEntries: (path) => filesystem.snapshotEntries(path),
    snapshotFile: (path) => filesystem.snapshotFile(path),
  };
}

export function requireSnapshotFileSystem(
  filesystem: BusinessFileSystem,
): SnapshotBusinessFileSystem {
  if (
    typeof filesystem.snapshotEntry !== "function"
    || typeof filesystem.snapshotEntries !== "function"
    || typeof filesystem.snapshotFile !== "function"
  ) {
    throw new TypeError("Snapshot filesystem capabilities are required.");
  }
  return {
    lstat: filesystem.lstat,
    readFile: filesystem.readFile,
    readdir: filesystem.readdir,
    snapshotEntry: filesystem.snapshotEntry,
    snapshotEntries: filesystem.snapshotEntries,
    snapshotFile: filesystem.snapshotFile,
  };
}

export interface RepositoryChanges {
  conflicted: { path: string; kind?: string; originalPath?: string }[];
  staged: { path: string; kind?: string; originalPath?: string }[];
  unstaged: { path: string; kind?: string; originalPath?: string }[];
  untracked: { path: string; kind?: string; originalPath?: string }[];
}

export interface RepositoryBranch {
  branch: string | null;
  remote: string | null;
  repository: string | null;
  upstreamBranch: string | null;
}

export interface RepositoryState {
  branch: RepositoryBranch;
  changes: RepositoryChanges;
  head: string | null;
}

export type { Problem };
export type ProjectObservation = Observation;

export interface ReadyObservation {
  config: ProjectConfig;
  contentLanguage: string;
  layout: import("./idea-layout.ts").IdeaLayout;
  observation: ProjectReadyObservation;
  outputLanguage: string;
  outputLanguageOverride?: string;
  findings: { instruction: string }[];
  projectReady: true;
  schemas?: import("../../foundation/schema-capability/index.ts").ProjectSchemaReadiness;
}

export interface UnreadyObservation {
  config: ProjectConfig | null;
  contentLanguage: string;
  findings: { instruction: string }[];
  layout: import("./idea-layout.ts").IdeaLayout | null;
  observation: ProjectObservation;
  outputLanguage: string;
  outputLanguageOverride?: string;
  projectReady: false;
  schemas?: import("../../foundation/schema-capability/index.ts").ProjectSchemaReadiness;
}

export type SnapshotObservation = ReadyObservation | UnreadyObservation;

export type RepositoryReadiness =
  | {
      branch?: RepositoryBranch;
      changes?: RepositoryChanges;
      head?: string | null;
      observation: RepositoryBlockedObservation;
      primary?: string;
      instructions: string;
      ready: false;
    }
  | {
      branch: RepositoryBranch;
      changes?: RepositoryChanges;
      head: string;
      observation: ProjectReadyObservation;
      primary?: string;
      ready: true;
    };

/** @pure */
export function repositoryProblem(
  observation: ProjectReadyObservation,
  problems: Problem[],
): RepositoryBlockedObservation {
  return {
    ...observation,
    state: "repository-sync-required",
    problems,
  };
}

export type CommandRuntime = ReturnType<
  typeof import("../../foundation/command-message/index.ts").createCommandRun
>;

/** @pure */
export function errorMessage(value: unknown): string {
  return value instanceof Error ? value.message : String(value);
}

export async function traceBusinessAsync<Result>(
  name: string,
  attributes: Record<string, unknown>,
  operation: () => Promise<Result>,
  finish?: (result: Result) => Record<string, unknown>,
): Promise<Result> {
  let result: Promise<Result> | undefined;
  const invoke = (): Promise<Result> => {
    result ??= operation();
    return result;
  };
  await Reflect.apply(traceAsync, undefined, [
    name,
    attributes,
    invoke,
    ...(finish ? [finish] : []),
  ]);
  if (!result) throw new Error(`Trace ${name} did not invoke its operation.`);
  return result;
}
