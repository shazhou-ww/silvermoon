import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";
import { Ajv2020 } from "ajv/dist/2020.js";

import {
  findSchemaMigrationPath,
  loadSchemaCapabilityManifest,
} from "../../src/foundation/schema-capability/index.ts";
import {
  IMPLEMENTED_SCHEMA_MIGRATIONS,
} from "../../src/business/schema-migration.ts";

test("schema capability manifest validates and references packaged artifacts", async () => {
  const schema = JSON.parse(await readFile(
    new URL("../../schema/capability-manifest.schema.json", import.meta.url),
    "utf8",
  ));
  const manifest = JSON.parse(await readFile(
    new URL("../../schema/capabilities.json", import.meta.url),
    "utf8",
  ));
  const validate = new Ajv2020({ strict: true }).compile(schema);

  assert.equal(validate(manifest), true, JSON.stringify(validate.errors));
  const packageManifest = JSON.parse(await readFile(
    new URL("../../package.json", import.meta.url),
    "utf8",
  ));
  assert.equal(manifest.releaseBoundary, packageManifest.version);
  assert.deepEqual(
    Object.keys(manifest.migrations).sort(),
    [...IMPLEMENTED_SCHEMA_MIGRATIONS].sort(),
  );
  for (const family of Object.values(manifest.families) as Array<{
    readVersions: number[];
    schemas: Record<string, string>;
  }>) {
    assert.deepEqual(
      Object.keys(family.schemas).map(Number).sort((left, right) => left - right),
      [...family.readVersions].sort((left, right) => left - right),
    );
    await Promise.all(
      Object.values(family.schemas).map((path) =>
        access(resolve(import.meta.dirname, "../..", path))
      ),
    );
  }
  for (const migration of Object.values(manifest.migrations) as Array<{
    entrypoint: string;
    executable: string;
    sourceEntrypoint: string;
  }>) {
    assert.equal(packageManifest.bin[migration.executable], migration.entrypoint);
    await Promise.all([
      access(resolve(import.meta.dirname, "../..", migration.sourceEntrypoint)),
      access(resolve(import.meta.dirname, "../..", migration.entrypoint)),
    ]);
    assert.doesNotMatch(migration.entrypoint, /single-file/);
  }
});

test("every readable historical schema has one continuous migration path", async () => {
  const manifest = await loadSchemaCapabilityManifest();

  for (const [familyName, family] of Object.entries(manifest.families)) {
    for (const version of family.readVersions) {
      const path = findSchemaMigrationPath(manifest, familyName, version);
      assert.notEqual(path, null, `${familyName} v${version}`);
      assert.equal(
        path?.at(-1)?.toVersions[familyName] ?? version,
        family.targetVersion,
        `${familyName} v${version} must reach v${family.targetVersion}`,
      );
    }
  }
});
