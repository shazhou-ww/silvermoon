import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "node:test";

import {
  serializeIdeaEvents,
} from "../../src/foundation/event-codec/index.ts";
import {
  classifySchemaVersion,
  findSchemaMigrationPath,
  inspectProjectSchemas,
  loadSchemaCapabilityManifest,
  validateSchemaCapabilityManifest,
} from "../../src/foundation/schema-capability/index.ts";

const temporaryDirectories: string[] = [];
const ids = {
  historical: "01M36QGPNTXEPP61DA4KP4AVZA",
  current: "01M36QGPNTXEPP61DA4KP4AVZB",
  invalid: "01M36QGPNTXEPP61DA4KP4AVZC",
  future: "01M36QGPNTXEPP61DA4KP4AVZD",
};

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true })
    ),
  );
});

async function writeMetadata(
  root: string,
  path: string,
  source: string,
) {
  const segments = path.split("/");
  await mkdir(join(root, ...segments.slice(0, -1)), { recursive: true });
  await writeFile(join(root, ...segments), source);
}

test("loads the packaged schema capability contract", async () => {
  const manifest = await loadSchemaCapabilityManifest();

  assert.equal(manifest.manifestVersion, 1);
  assert.equal(manifest.releaseBoundary, "0.5.0");
  assert.deepEqual(manifest.families["project-config"]?.readVersions, [1, 2]);
  assert.equal(manifest.families["project-config"]?.targetVersion, 2);
  assert.deepEqual(
    manifest.families["idea-state"]?.migrations,
    ["project-v1-to-v2"],
  );
  assert.deepEqual(manifest.migrations["project-v1-to-v2"], {
    id: "project-v1-to-v2",
    kind: "schema",
    fromVersions: {
      "project-config": 1,
      "idea-state": 1,
    },
    toVersions: {
      "project-config": 2,
      "idea-state": 2,
    },
    entrypoint: "dist/bin/silvermoon.js",
    sourceEntrypoint: "bin/silvermoon.ts",
    executable: "silvermoon",
    arguments: ["migrate"],
    guarantees: [
      "read-only-plan",
      "exact-digest-apply",
      "resume",
      "rollback",
      "semantic-projection-equivalence",
    ],
  });
});

test("classifies current, historical, future and unknown schema versions", async () => {
  const manifest = await loadSchemaCapabilityManifest();

  assert.deepEqual(classifySchemaVersion(manifest, "idea-state", 2), {
    validity: "valid",
    readiness: "current",
  });
  assert.equal(
    classifySchemaVersion(manifest, "idea-state", 1).readiness,
    "migration-required",
  );
  assert.deepEqual(
    findSchemaMigrationPath(manifest, "idea-state", 1)?.map(({ id }) => id),
    ["project-v1-to-v2"],
  );
  assert.deepEqual(classifySchemaVersion(manifest, "idea-state", 3), {
    validity: "unsupported",
    readiness: "runtime-upgrade-required",
    message: "Runtime read capability ends at schema version 2.",
  });
  assert.equal(
    classifySchemaVersion(manifest, "idea-state", 0).readiness,
    "unknown",
  );
});

test("rejects a manifest that breaks a historical migration path", async () => {
  const manifest = JSON.parse(await readFile(
    new URL("../../schema/capabilities.json", import.meta.url),
    "utf8",
  ));
  manifest.families["idea-state"].migrations = [];

  assert.throws(
    () => validateSchemaCapabilityManifest(manifest),
    /no continuous migration from version 1/,
  );
});

test("accumulates per-file validity and readiness across mixed project schemas", async () => {
  const root = await mkdtemp(join(tmpdir(), "silvermoon-schema-capability-"));
  temporaryDirectories.push(root);
  await writeMetadata(
    root,
    ".silvermoon/config.yaml",
    `version: 2
primaryRepository: https://example.test/owner/repository.git
primaryBranch: main
`,
  );
  await writeMetadata(
    root,
    `.silvermoon/ideas/${ids.historical}/status.yaml`,
    `version: 1
id: ${ids.historical}
alias: historical
`,
  );
  await writeMetadata(
    root,
    `.silvermoon/ideas/${ids.current}/events.jsonl`,
    serializeIdeaEvents([{
      sequence: 1,
      type: "setAlias",
      payload: { alias: "current" },
    }]),
  );
  await writeMetadata(
    root,
    `.silvermoon/ideas/${ids.invalid}/status.yaml`,
    `version: 1
id: ${ids.invalid}
abandoned: invalid
`,
  );
  await writeMetadata(
    root,
    `.silvermoon/ideas/${ids.future}/status.yaml`,
    `version: 3
id: ${ids.future}
`,
  );

  const readiness = await inspectProjectSchemas({ root });
  assert.deepEqual(
    readiness.files.map((file) => ({
      path: file.path,
      schemaVersion: file.schemaVersion,
      validity: file.validity,
      readiness: file.readiness,
    })),
    [
      {
        path: ".silvermoon/config.yaml",
        schemaVersion: 2,
        validity: "valid",
        readiness: "current",
      },
      {
        path: `.silvermoon/ideas/${ids.historical}/status.yaml`,
        schemaVersion: 1,
        validity: "valid",
        readiness: "migration-required",
      },
      {
        path: `.silvermoon/ideas/${ids.current}/events.jsonl`,
        schemaVersion: 2,
        validity: "valid",
        readiness: "current",
      },
      {
        path: `.silvermoon/ideas/${ids.invalid}/status.yaml`,
        schemaVersion: 1,
        validity: "invalid",
        readiness: "migration-required",
      },
      {
        path: `.silvermoon/ideas/${ids.future}/status.yaml`,
        schemaVersion: 3,
        validity: "unsupported",
        readiness: "runtime-upgrade-required",
      },
    ],
  );
  assert.match(
    readiness.files.find(({ path }) => path.includes(ids.invalid))?.message
      ?? "",
    /abandoned/,
  );
});
