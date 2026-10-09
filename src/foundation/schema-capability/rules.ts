export interface SchemaMigrationCapability {
  id: string;
  fromVersion: number;
  toVersion: number;
  entrypoint: string;
}

export interface SchemaFamilyCapability {
  scope: "project" | "device" | "runtime";
  pathPatterns: string[];
  targetVersion: number;
  readVersions: number[];
  schemas: Record<string, string>;
  migrations: SchemaMigrationCapability[];
}

export interface SchemaCapabilityManifest {
  manifestVersion: 1;
  releaseBoundary: string;
  families: Record<string, SchemaFamilyCapability>;
}

export interface SchemaVersionClassification {
  validity: "valid" | "invalid" | "unsupported";
  readiness:
    | "current"
    | "migration-required"
    | "migration-unavailable"
    | "runtime-upgrade-required"
    | "unknown";
  migration?: SchemaMigrationCapability;
  message?: string;
}

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
function schemaMigration(value: unknown): value is SchemaMigrationCapability {
  return mapping(value)
    && "id" in value
    && typeof value.id === "string"
    && value.id.length > 0
    && "fromVersion" in value
    && positiveVersion(value.fromVersion)
    && "toVersion" in value
    && positiveVersion(value.toVersion)
    && "entrypoint" in value
    && typeof value.entrypoint === "string"
    && value.entrypoint.length > 0;
}

/** @pure */
function schemaFamily(value: unknown): value is SchemaFamilyCapability {
  if (!mapping(value)) {
    return false;
  }
  if (!("scope" in value)
    || !["project", "device", "runtime"].includes(String(value.scope))
    || !("pathPatterns" in value)
    || !Array.isArray(value.pathPatterns)
    || value.pathPatterns.length === 0
    || !value.pathPatterns.every((path) =>
      typeof path === "string" && path.length > 0
    )
    || !("targetVersion" in value)
    || !positiveVersion(value.targetVersion)
    || !("readVersions" in value)
    || !Array.isArray(value.readVersions)
    || value.readVersions.length === 0
    || !value.readVersions.every(positiveVersion)
    || !value.readVersions.includes(value.targetVersion)
    || !("schemas" in value)
    || !mapping(value.schemas)
    || !("migrations" in value)
    || !Array.isArray(value.migrations)
    || !value.migrations.every(schemaMigration)) {
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
export function validateSchemaCapabilityManifest(
  value: unknown,
): SchemaCapabilityManifest {
  if (value === null || typeof value !== "object" || Array.isArray(value)
    || !("manifestVersion" in value) || value.manifestVersion !== 1
    || !("releaseBoundary" in value)
    || typeof value.releaseBoundary !== "string"
    || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value.releaseBoundary)
    || !("families" in value)
    || value.families === null
    || typeof value.families !== "object"
    || Array.isArray(value.families)) {
    throw new TypeError("Invalid Silvermoon schema capability manifest.");
  }
  const families = Object.entries(value.families);
  if (families.length === 0 || families.some(([, family]) =>
    !schemaFamily(family)
  )) {
    throw new TypeError("Invalid Silvermoon schema family capability.");
  }
  return {
    manifestVersion: 1,
    releaseBoundary: value.releaseBoundary,
    families: Object.fromEntries(families) as Record<
      string,
      SchemaFamilyCapability
    >,
  };
}

/** @pure */
export function classifySchemaVersion(
  family: SchemaFamilyCapability,
  schemaVersion: unknown,
): SchemaVersionClassification {
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
  const migration = family.migrations.find(({ fromVersion, toVersion }) =>
    fromVersion === schemaVersion && toVersion === family.targetVersion
  );
  return migration === undefined
    ? {
      validity: "valid",
      readiness: "migration-unavailable",
      message: `No migration reaches target schema version ${family.targetVersion}.`,
    }
    : {
      validity: "valid",
      readiness: "migration-required",
      migration,
    };
}
