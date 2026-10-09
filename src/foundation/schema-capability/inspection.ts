import { lstat, readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

import { IDEAS_ROOT, ideaPaths } from "../coordinates/index.ts";
import {
  parseIdeaEvents,
  replayIdeaEvents,
} from "../event-codec/index.ts";
import { validateEventRecordSizes } from "../event-store/index.ts";
import { parseIdeaStatus } from "../idea-model/index.ts";
import { parseConfigSource } from "../project-config/index.ts";
import { parseStrictYaml } from "../schema/index.ts";
import {
  classifySchemaVersion,
  type SchemaCapabilityManifest,
  type SchemaMigrationCapability,
} from "./rules.ts";
import { loadSchemaCapabilityManifest } from "./manifest.ts";

interface FileMetadata {
  isDirectory(): boolean;
  isFile(): boolean;
  isSymbolicLink(): boolean;
}

interface DirectoryEntry {
  name: string;
}

interface SchemaFileSystem {
  lstat(path: string): Promise<FileMetadata>;
  readFile(path: string): Promise<Buffer>;
  readdir(path: string, options: { withFileTypes: true }): Promise<DirectoryEntry[]>;
}

export interface SchemaFileReadiness {
  path: string;
  family: string;
  schemaVersion: number | null;
  targetVersion: number;
  validity: "valid" | "invalid" | "unsupported";
  readiness:
    | "current"
    | "migration-required"
    | "migration-unavailable"
    | "runtime-upgrade-required"
    | "unknown";
  migrationPath?: SchemaMigrationCapability[];
  message?: string;
}

export interface ProjectSchemaReadiness {
  manifestVersion: 1;
  releaseBoundary: string;
  files: SchemaFileReadiness[];
}

const DEFAULT_FILESYSTEM = { lstat, readFile, readdir };

function errorCode(cause: unknown) {
  return cause instanceof Error && "code" in cause
      && typeof cause.code === "string"
    ? cause.code
    : undefined;
}

function errorMessage(cause: unknown) {
  return cause instanceof Error ? cause.message : String(cause);
}

function isMapping(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

async function metadata(
  path: string,
  filesystem: Pick<SchemaFileSystem, "lstat">,
) {
  try {
    return await filesystem.lstat(path);
  } catch (cause) {
    if (errorCode(cause) === "ENOENT") return null;
    throw cause;
  }
}

function declaredYamlVersion(source: string) {
  const value = parseStrictYaml(source);
  if (!isMapping(value)) {
    throw new TypeError("Schema-bearing YAML must be a mapping.");
  }
  return value.version;
}

function familyCapability(
  manifest: SchemaCapabilityManifest,
  family: string,
) {
  const capability = manifest.families[family];
  if (capability === undefined) {
    throw new TypeError(`Schema capability manifest is missing ${family}.`);
  }
  return capability;
}

function readinessRecord({
  family,
  path,
  schemaVersion,
  manifest,
  validation,
}: {
  family: string;
  path: string;
  schemaVersion: unknown;
  manifest: SchemaCapabilityManifest;
  validation?: () => void;
}): SchemaFileReadiness {
  const capability = familyCapability(manifest, family);
  const classified = classifySchemaVersion(manifest, family, schemaVersion);
  let validity = classified.validity;
  let message = classified.message;
  if (validity !== "unsupported" && validation !== undefined) {
    try {
      validation();
    } catch (cause) {
      validity = "invalid";
      message = errorMessage(cause);
    }
  }
  return {
    path,
    family,
    schemaVersion: typeof schemaVersion === "number"
        && Number.isSafeInteger(schemaVersion)
      ? schemaVersion
      : null,
    targetVersion: capability.targetVersion,
    validity,
    readiness: classified.readiness,
    ...(classified.migrationPath === undefined
      ? {}
      : { migrationPath: classified.migrationPath }),
    ...(message === undefined ? {} : { message }),
  };
}

function validateConfig(
  root: string,
  path: string,
  source: string,
) {
  const inspected = parseConfigSource({
    absolutePath: resolve(root, path),
    root,
    source,
  });
  if (inspected.diagnostics.length > 0) {
    throw new Error(
      inspected.diagnostics.map(({ message }) => message).join("; "),
    );
  }
}

function validateEvents(id: string, bytes: Buffer) {
  validateEventRecordSizes(bytes);
  const failures: string[] = [];
  for (const legacy of [false, true]) {
    try {
      const events = parseIdeaEvents(bytes, legacy ? { legacy: true } : {});
      const replayed = replayIdeaEvents(
        id,
        events,
        legacy ? { legacy: true } : {},
      );
      if (!replayed.ok && "sequence" in replayed && "code" in replayed) {
        throw new Error(`Event ${replayed.sequence}: ${replayed.code}`);
      }
      return;
    } catch (cause) {
      failures.push(errorMessage(cause));
    }
  }
  throw new Error(failures.join("; "));
}

async function inspectConfig(
  root: string,
  manifest: SchemaCapabilityManifest,
  filesystem: SchemaFileSystem,
) {
  const path = ".silvermoon/config.yaml";
  const file = await metadata(resolve(root, path), filesystem);
  if (file === null) return null;
  if (!file.isFile() || file.isSymbolicLink()) {
    return readinessRecord({
      family: "project-config",
      path,
      schemaVersion: null,
      manifest,
      validation: () => {
        throw new TypeError("Configuration must be a repository-owned regular file.");
      },
    });
  }
  let source: string;
  let version: unknown;
  try {
    source = (await filesystem.readFile(resolve(root, path))).toString("utf8");
    version = declaredYamlVersion(source);
  } catch (cause) {
    return readinessRecord({
      family: "project-config",
      path,
      schemaVersion: null,
      manifest,
      validation: () => {
        throw cause;
      },
    });
  }
  return readinessRecord({
    family: "project-config",
    path,
    schemaVersion: version,
    manifest,
    validation: () => validateConfig(root, path, source),
  });
}

async function inspectIdeaState(
  root: string,
  id: string,
  path: string,
  projectSchemaVersion: number | null,
  manifest: SchemaCapabilityManifest,
  filesystem: SchemaFileSystem,
) {
  const file = await metadata(resolve(root, path), filesystem);
  if (file === null) return null;
  if (!file.isFile() || file.isSymbolicLink()) {
    return readinessRecord({
      family: "idea-state",
      path,
      schemaVersion: null,
      manifest,
      validation: () => {
        throw new TypeError("Idea state must be a repository-owned regular file.");
      },
    });
  }
  let bytes: Buffer;
  try {
    bytes = await filesystem.readFile(resolve(root, path));
  } catch (cause) {
    return readinessRecord({
      family: "idea-state",
      path,
      schemaVersion: null,
      manifest,
      validation: () => {
        throw cause;
      },
    });
  }
  if (path.endsWith("/events.jsonl")) {
    return readinessRecord({
      family: "idea-state",
      path,
      schemaVersion: projectSchemaVersion,
      manifest,
      validation: () => {
        if (projectSchemaVersion !== 2) {
          throw new TypeError(
            `events.jsonl does not represent idea-state schema version ${String(projectSchemaVersion)}.`,
          );
        }
        validateEvents(id, bytes);
      },
    });
  }
  let version: unknown;
  try {
    version = declaredYamlVersion(bytes.toString("utf8"));
  } catch (cause) {
    return readinessRecord({
      family: "idea-state",
      path,
      schemaVersion: null,
      manifest,
      validation: () => {
        throw cause;
      },
    });
  }
  return readinessRecord({
    family: "idea-state",
    path,
    schemaVersion: version,
    manifest,
    validation: () => {
      if (version !== 1) {
        throw new TypeError(
          `status.yaml does not represent idea-state schema version ${String(version)}.`,
        );
      }
      parseIdeaStatus(bytes.toString("utf8"));
    },
  });
}

export async function inspectProjectSchemas({
  filesystem = DEFAULT_FILESYSTEM,
  manifest,
  root,
}: {
  filesystem?: SchemaFileSystem;
  manifest?: SchemaCapabilityManifest;
  root: string;
}): Promise<ProjectSchemaReadiness> {
  const resolvedManifest = manifest ?? await loadSchemaCapabilityManifest();
  const files: SchemaFileReadiness[] = [];
  const config = await inspectConfig(root, resolvedManifest, filesystem);
  if (config !== null) files.push(config);
  const projectSchemaVersion = config?.schemaVersion ?? null;
  const ideasRoot = resolve(root, IDEAS_ROOT);
  const ideasMetadata = await metadata(ideasRoot, filesystem);
  if (ideasMetadata?.isDirectory() && !ideasMetadata.isSymbolicLink()) {
    const entries = await filesystem.readdir(ideasRoot, {
      withFileTypes: true,
    });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const paths = ideaPaths(entry.name);
      for (const path of [paths.statusPath, paths.eventsPath]) {
        const inspected = await inspectIdeaState(
          root,
          entry.name,
          path,
          projectSchemaVersion,
          resolvedManifest,
          filesystem,
        );
        if (inspected !== null) files.push(inspected);
      }
    }
  }
  files.sort((left, right) => left.path.localeCompare(right.path));
  return {
    manifestVersion: resolvedManifest.manifestVersion,
    releaseBoundary: resolvedManifest.releaseBoundary,
    files,
  };
}
