import { cp, lstat, readFile, readdir, rm } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { Buffer } from "node:buffer";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const canonical = resolve(repositoryRoot, "skills", "silvermoon");
const registration = resolve(repositoryRoot, ".agents", "skills", "silvermoon");
const args = process.argv.slice(2);
const checkOnly = args.length === 1 && args[0] === "--check";

if (args.length > 0 && !checkOnly) {
  throw new Error("Usage: node bin/sync-skills.mjs [--check]");
}

function errorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null
    && "code" in error && typeof error.code === "string" ? error.code : undefined;
}

async function files(root: string): Promise<Map<string, Buffer>> {
  const result = new Map<string, Buffer>();

  async function visit(directory: string): Promise<void> {
    const entries = (await readdir(directory, { withFileTypes: true }))
      .sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(path);
      } else if (entry.isFile()) {
        result.set(relative(root, path).split(sep).join("/"), await readFile(path));
      } else {
        throw new Error(`Skill contains a non-regular path: ${path}`);
      }
    }
  }

  await visit(root);
  return result;
}

async function assertSynchronized() {
  const expected = await files(canonical);
  let actual;
  try {
    const metadata = await lstat(registration);
    if (!metadata.isDirectory()) {
      throw new Error(`Skill registration is not a directory: ${registration}`);
    }
    actual = await files(registration);
  } catch (error) {
    if (errorCode(error) === "ENOENT") {
      throw new Error(`Skill registration is missing: ${registration}`);
    }
    throw error;
  }

  const differences = [];
  for (const [path, contents] of expected) {
    const actualContents = actual.get(path);
    if (actualContents === undefined) {
      differences.push(`missing ${path}`);
    } else if (!contents.equals(actualContents)) {
      differences.push(`changed ${path}`);
    }
  }
  for (const path of actual.keys()) {
    if (!expected.has(path)) differences.push(`unexpected ${path}`);
  }
  if (differences.length > 0) {
    throw new Error(
      `Repository skill is out of sync; run pnpm sync:skills:\n${differences.join("\n")}`,
    );
  }

  return expected.size;
}

if (!checkOnly) {
  await rm(registration, { force: true, recursive: true });
  await cp(canonical, registration, { errorOnExist: true, recursive: true });
}

const count = await assertSynchronized();
process.stdout.write(`${checkOnly ? "SKILLS_CHECK_OK" : "SKILLS_SYNC_OK"} files=${count}\n`);
