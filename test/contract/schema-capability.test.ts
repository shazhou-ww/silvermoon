import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";
import { Ajv2020 } from "ajv/dist/2020.js";

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
});
