import { resolve } from "node:path";

import {
  inspectProjectSchemas,
  loadSchemaCapabilityManifest,
} from "../foundation/schema-capability/index.ts";
import {
  regularBytes,
  TRANSACTION_PATH,
} from "../foundation/state-transaction/index.ts";
import {
  migrateEvents,
  PROJECT_V1_TO_V2_MIGRATION_ID,
  type MigrationOptions,
} from "./migrate-v1-to-v2.ts";

const MIGRATION_IMPLEMENTATIONS = {
  [PROJECT_V1_TO_V2_MIGRATION_ID]: migrateEvents,
} as const;

export const IMPLEMENTED_SCHEMA_MIGRATIONS = Object.freeze(
  Object.keys(MIGRATION_IMPLEMENTATIONS),
);

export async function runSchemaMigration(
  migrationId: string,
  options: MigrationOptions = {},
) {
  const manifest = await loadSchemaCapabilityManifest();
  const migration = manifest.migrations[migrationId];
  if (migration === undefined) {
    throw new Error(`Unknown schema migration: ${migrationId}.`);
  }
  if (!Object.hasOwn(MIGRATION_IMPLEMENTATIONS, migrationId)) {
    throw new Error(
      `Schema migration ${migrationId} is declared but not implemented by this runtime.`,
    );
  }
  const execute = MIGRATION_IMPLEMENTATIONS[
    migrationId as keyof typeof MIGRATION_IMPLEMENTATIONS
  ];
  const receipt = await execute(options);
  return {
    migrationId,
    ...receipt,
  };
}

function transactionMigrationId(value: unknown) {
  if (value === null || typeof value !== "object") return null;
  const context = Reflect.get(value, "context");
  if (context === null || typeof context !== "object") return null;
  const migrationId = Reflect.get(context, "migrationId");
  return typeof migrationId === "string" ? migrationId : null;
}

export async function resolveProjectSchemaMigration(
  options: Pick<MigrationOptions, "root" | "resume" | "rollback"> = {},
) {
  const root = resolve(options.root ?? process.cwd());
  if (options.resume || options.rollback) {
    const transaction = await regularBytes(resolve(root, TRANSACTION_PATH));
    if (transaction !== null) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(transaction.toString("utf8"));
      } catch (cause) {
        throw new Error(
          `Cannot identify the interrupted schema migration from ${TRANSACTION_PATH}; preserve it for recovery.`,
          { cause },
        );
      }
      const migrationId = transactionMigrationId(parsed);
      if (migrationId !== null) return migrationId;
    }
  }

  const schemas = await inspectProjectSchemas({ root });
  const migrationIds = new Set(
    schemas.files.flatMap((file) =>
      file.validity === "valid"
        && file.readiness === "migration-required"
        && file.migrationPath?.[0] !== undefined
        ? [file.migrationPath[0].id]
        : []
    ),
  );
  if (migrationIds.size === 1) {
    return [...migrationIds][0] as string;
  }
  if (migrationIds.size > 1) {
    throw new Error(
      `Project schemas require multiple next migrations (${[...migrationIds].sort().join(", ")}); update Silvermoon so one project-level migration can coordinate them.`,
    );
  }
  if (IMPLEMENTED_SCHEMA_MIGRATIONS.length === 1) {
    return IMPLEMENTED_SCHEMA_MIGRATIONS[0] as string;
  }
  throw new Error(
    "No project schema migration is currently required or recoverable.",
  );
}

export async function runProjectSchemaMigration(
  options: MigrationOptions = {},
) {
  const migrationId = await resolveProjectSchemaMigration(options);
  return runSchemaMigration(migrationId, options);
}
