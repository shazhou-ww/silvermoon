import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { validateSchemaCapabilityManifest } from "./rules.ts";

const packageRoot = fileURLToPath(new URL(
  import.meta.url.endsWith(".ts") ? "../../.." : "../../../..",
  import.meta.url,
));
export const SCHEMA_CAPABILITY_MANIFEST_PATH = resolve(
  packageRoot,
  "schema",
  "capabilities.json",
);

export async function loadSchemaCapabilityManifest({
  filesystem = { readFile },
  path = SCHEMA_CAPABILITY_MANIFEST_PATH,
}: {
  filesystem?: Pick<typeof import("node:fs/promises"), "readFile">;
  path?: string;
} = {}) {
  let value: unknown;
  try {
    value = JSON.parse(await filesystem.readFile(path, "utf8"));
  } catch (cause) {
    throw new Error(`Cannot read Silvermoon schema capability manifest: ${
      cause instanceof Error ? cause.message : String(cause)
    }`, { cause });
  }
  return validateSchemaCapabilityManifest(value);
}
