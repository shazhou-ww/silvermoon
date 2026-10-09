export type SchemaMigrationGuarantee =
  | "read-only-plan"
  | "exact-digest-apply"
  | "resume"
  | "rollback"
  | "semantic-projection-equivalence";

export interface SchemaMigrationCapability {
  id: string;
  kind: "schema";
  fromVersions: Record<string, number>;
  toVersions: Record<string, number>;
  entrypoint: string;
  sourceEntrypoint: string;
  executable: string;
  guarantees: SchemaMigrationGuarantee[];
}

export interface SchemaFamilyCapability {
  scope: "project" | "device" | "runtime";
  pathPatterns: string[];
  targetVersion: number;
  readVersions: number[];
  schemas: Record<string, string>;
  migrations: string[];
}

export interface SchemaCapabilityManifest {
  manifestVersion: 1;
  releaseBoundary: string;
  families: Record<string, SchemaFamilyCapability>;
  migrations: Record<string, SchemaMigrationCapability>;
}

export interface SchemaVersionClassification {
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

const MIGRATION_GUARANTEES: readonly SchemaMigrationGuarantee[] = [
  "read-only-plan",
  "exact-digest-apply",
  "resume",
  "rollback",
  "semantic-projection-equivalence",
];

/** @pure */
function positiveVersion(value: unknown): value is number {
  return typeof value === "number"
    && Number.isSafeInteger(value)
    && value > 0;
}

/** @pure */
function mapping(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** @pure */
function onlyKeys(value: Record<string, unknown>, allowed: readonly string[]) {
  return Object.keys(value).every((key) => allowed.includes(key));
}

/** @pure */
function identifier(value: unknown): value is string {
  return typeof value === "string"
    && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

/** @pure */
function versionSet(value: unknown): value is Record<string, number> {
  return mapping(value)
    && Object.keys(value).length > 0
    && Object.entries(value).every(([family, version]) =>
      identifier(family) && positiveVersion(version)
    );
}

/** @pure */
function schemaMigration(
  id: string,
  value: unknown,
): SchemaMigrationCapability | null {
  if (!identifier(id)
    || !mapping(value)
    || !onlyKeys(value, [
      "kind",
      "fromVersions",
      "toVersions",
      "entrypoint",
      "sourceEntrypoint",
      "executable",
      "guarantees",
    ])
    || value.kind !== "schema") {
    return null;
  }
  const fromVersions = value.fromVersions;
  const toVersions = value.toVersions;
  if (!versionSet(fromVersions)
    || !versionSet(toVersions)
    || typeof value.entrypoint !== "string"
    || value.entrypoint.length === 0
    || typeof value.sourceEntrypoint !== "string"
    || value.sourceEntrypoint.length === 0
    || !identifier(value.executable)
    || !Array.isArray(value.guarantees)
    || value.guarantees.length !== MIGRATION_GUARANTEES.length
    || !value.guarantees.every((guarantee) =>
      typeof guarantee === "string"
      && MIGRATION_GUARANTEES.includes(
        guarantee as SchemaMigrationGuarantee,
      )
    )
    || new Set(value.guarantees).size !== value.guarantees.length) {
    return null;
  }
  const fromFamilies = Object.keys(fromVersions).sort();
  const toFamilies = Object.keys(toVersions).sort();
  if (fromFamilies.join("\0") !== toFamilies.join("\0")
    || fromFamilies.every((family) =>
      fromVersions[family] === toVersions[family]
    )) {
    return null;
  }
  return {
    id,
    kind: "schema",
    fromVersions,
    toVersions,
    entrypoint: value.entrypoint,
    sourceEntrypoint: value.sourceEntrypoint,
    executable: value.executable,
    guarantees: value.guarantees as SchemaMigrationGuarantee[],
  };
}

/** @pure */
function schemaFamily(value: unknown): value is SchemaFamilyCapability {
  if (!mapping(value)
    || !onlyKeys(value, [
      "scope",
      "pathPatterns",
      "targetVersion",
      "readVersions",
      "schemas",
      "migrations",
    ])) {
    return false;
  }
  if (!["project", "device", "runtime"].includes(String(value.scope))
    || !Array.isArray(value.pathPatterns)
    || value.pathPatterns.length === 0
    || !value.pathPatterns.every((path) =>
      typeof path === "string" && path.length > 0
    )
    || new Set(value.pathPatterns).size !== value.pathPatterns.length
    || !positiveVersion(value.targetVersion)
    || !Array.isArray(value.readVersions)
    || value.readVersions.length === 0
    || !value.readVersions.every(positiveVersion)
    || !value.readVersions.includes(value.targetVersion)
    || !mapping(value.schemas)
    || !Array.isArray(value.migrations)
    || !value.migrations.every(identifier)
    || new Set(value.migrations).size !== value.migrations.length) {
    return false;
  }
  const versions = new Set(value.readVersions);
  if (versions.size !== value.readVersions.length) return false;
  const schemaArtifacts = value.schemas;
  const schemas = Object.entries(schemaArtifacts);
  if (schemas.length === 0 || schemas.some(([version, path]) =>
    !versions.has(Number(version))
    || typeof path !== "string"
    || path.length === 0
  )) {
    return false;
  }
  return value.readVersions.every((version) =>
    Object.hasOwn(schemaArtifacts, String(version))
  );
}

/** @pure */
export function findSchemaMigrationPath(
  manifest: SchemaCapabilityManifest,
  familyName: string,
  fromVersion: number,
): SchemaMigrationCapability[] | null {
  const family = manifest.families[familyName];
  if (family === undefined || !positiveVersion(fromVersion)) return null;
  if (fromVersion === family.targetVersion) return [];
  const queue: Array<{
    path: SchemaMigrationCapability[];
    version: number;
  }> = [{ path: [], version: fromVersion }];
  const visited = new Set([fromVersion]);
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    if (current === undefined) continue;
    for (const migrationId of family.migrations) {
      const migration = manifest.migrations[migrationId];
      if (migration?.fromVersions[familyName] !== current.version) continue;
      const nextVersion = migration.toVersions[familyName];
      if (nextVersion === undefined) continue;
      const path = [...current.path, migration];
      if (nextVersion === family.targetVersion) return path;
      if (!visited.has(nextVersion)) {
        visited.add(nextVersion);
        queue.push({ path, version: nextVersion });
      }
    }
  }
  return null;
}

/** @pure */
export function validateSchemaCapabilityManifest(
  value: unknown,
): SchemaCapabilityManifest {
  if (!mapping(value)
    || !onlyKeys(value, [
      "$schema",
      "manifestVersion",
      "releaseBoundary",
      "families",
      "migrations",
    ])
    || value.manifestVersion !== 1
    || typeof value.releaseBoundary !== "string"
    || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value.releaseBoundary)
    || !mapping(value.families)
    || !mapping(value.migrations)) {
    throw new TypeError("Invalid Silvermoon schema capability manifest.");
  }
  const familyEntries = Object.entries(value.families);
  if (familyEntries.length === 0 || familyEntries.some(([name, family]) =>
    !identifier(name) || !schemaFamily(family)
  )) {
    throw new TypeError("Invalid Silvermoon schema family capability.");
  }
  const migrationEntries = Object.entries(value.migrations);
  const parsedMigrations = migrationEntries.map(([id, migration]) =>
    schemaMigration(id, migration)
  );
  if (parsedMigrations.some((migration) => migration === null)) {
    throw new TypeError("Invalid Silvermoon schema migration capability.");
  }
  const manifest: SchemaCapabilityManifest = {
    manifestVersion: 1,
    releaseBoundary: value.releaseBoundary,
    families: Object.fromEntries(familyEntries) as Record<
      string,
      SchemaFamilyCapability
    >,
    migrations: Object.fromEntries(
      parsedMigrations.map((migration) => {
        if (migration === null) {
          throw new TypeError("Invalid Silvermoon schema migration.");
        }
        return [migration.id, migration];
      }),
    ),
  };
  for (const [familyName, family] of Object.entries(manifest.families)) {
    const transitions = new Map<number, string>();
    for (const migrationId of family.migrations) {
      const migration = manifest.migrations[migrationId];
      if (migration === undefined
        || migration.fromVersions[familyName] === undefined
        || migration.toVersions[familyName] === undefined) {
        throw new TypeError(
          `Schema family ${familyName} references invalid migration ${migrationId}.`,
        );
      }
      const fromVersion = migration.fromVersions[familyName];
      if (fromVersion === undefined) {
        throw new TypeError(
          `Migration ${migrationId} is missing ${familyName}.`,
        );
      }
      if (transitions.has(fromVersion)) {
        throw new TypeError(
          `Schema family ${familyName} has ambiguous migrations from version ${fromVersion}.`,
        );
      }
      transitions.set(fromVersion, migrationId);
    }
    for (const version of family.readVersions) {
      const visitedVersions = new Set<number>();
      let cursor = version;
      while (cursor !== family.targetVersion) {
        if (visitedVersions.has(cursor)) {
          throw new TypeError(
            `Schema family ${familyName} has a cyclic migration path from version ${version}.`,
          );
        }
        visitedVersions.add(cursor);
        const migrationId = transitions.get(cursor);
        if (migrationId === undefined) break;
        const nextVersion = manifest.migrations[migrationId]
          ?.toVersions[familyName];
        if (nextVersion === undefined) break;
        cursor = nextVersion;
      }
      const path = findSchemaMigrationPath(manifest, familyName, version);
      if (version !== family.targetVersion
        && path === null) {
        throw new TypeError(
          `Schema family ${familyName} has no continuous migration from version ${version}.`,
        );
      }
    }
  }
  for (const migration of Object.values(manifest.migrations)) {
    for (const [familyName, fromVersion] of Object.entries(
      migration.fromVersions,
    )) {
      const family = manifest.families[familyName];
      const toVersion = migration.toVersions[familyName];
      if (family === undefined
        || toVersion === undefined
        || !family.migrations.includes(migration.id)
        || !family.readVersions.includes(fromVersion)
        || !family.readVersions.includes(toVersion)
        || fromVersion === toVersion) {
        throw new TypeError(
          `Migration ${migration.id} is inconsistent with ${familyName}.`,
        );
      }
    }
  }
  return manifest;
}

/** @pure */
export function classifySchemaVersion(
  manifest: SchemaCapabilityManifest,
  familyName: string,
  schemaVersion: unknown,
): SchemaVersionClassification {
  const family = manifest.families[familyName];
  if (family === undefined) {
    return {
      validity: "invalid",
      readiness: "unknown",
      message: `Unknown schema family: ${familyName}.`,
    };
  }
  if (!positiveVersion(schemaVersion)) {
    return {
      validity: "invalid",
      readiness: "unknown",
      message: "Schema version must be a positive safe integer.",
    };
  }
  const maximumReadVersion = Math.max(...family.readVersions);
  if (schemaVersion > maximumReadVersion) {
    return {
      validity: "unsupported",
      readiness: "runtime-upgrade-required",
      message: `Runtime read capability ends at schema version ${maximumReadVersion}.`,
    };
  }
  if (!family.readVersions.includes(schemaVersion)) {
    return {
      validity: "invalid",
      readiness: "unknown",
      message: `Schema version ${schemaVersion} is not a supported historical version.`,
    };
  }
  if (schemaVersion === family.targetVersion) {
    return { validity: "valid", readiness: "current" };
  }
  const migrationPath = findSchemaMigrationPath(
    manifest,
    familyName,
    schemaVersion,
  );
  return migrationPath === null
    ? {
      validity: "valid",
      readiness: "migration-unavailable",
      message: `No migration reaches target schema version ${family.targetVersion}.`,
    }
    : {
      validity: "valid",
      readiness: "migration-required",
      migrationPath,
    };
}
