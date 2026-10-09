import {
  loadSchemaCapabilityManifest,
} from "../foundation/schema-capability/index.ts";
import {
  migrateEvents,
  type MigrationOptions,
} from "./migrate-v1-to-v2.ts";

const MIGRATION_IMPLEMENTATIONS = {
  "project-v1-to-v2": migrateEvents,
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
