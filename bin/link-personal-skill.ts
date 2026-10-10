#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { linkPersonalSkill } from "../src/foundation/installation/index.ts";

const skillRoot = fileURLToPath(new URL(
  import.meta.url.endsWith(".ts")
    ? "../skills/silvermoon"
    : "../../skills/silvermoon",
  import.meta.url,
));

export async function runLinkPersonalSkill() {
  const result = await linkPersonalSkill({ skillRoot });
  const action = result.status === "already-linked"
    ? "Already linked"
    : result.status === "replaced-copy"
    ? "Replaced copied skill with link"
    : result.status === "relinked"
    ? "Relinked"
    : "Linked";
  console.log(`${action}: ${result.destination} -> ${result.source}`);
}

function isMain() {
  if (process.argv[1] === undefined) return false;
  const canonical = (path: string) => {
    try {
      path = realpathSync.native(resolve(path));
    } catch {
      path = resolve(path);
    }
    return process.platform === "win32" ? path.toLowerCase() : path;
  };
  return canonical(fileURLToPath(import.meta.url)) === canonical(process.argv[1]);
}

if (isMain()) {
  try {
    await runLinkPersonalSkill();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
