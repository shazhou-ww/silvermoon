import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));
const documents = [
  "README.md",
  "README.zh-CN.md",
  "docs/getting-started.md",
  "docs/core-concepts.md",
  "docs/operations.md",
  "docs/reference.md",
  "docs/maintaining.md",
];

test("resolves repository-local links in reader documentation", async () => {
  for (const path of documents) {
    const absolute = resolve(repositoryRoot, path);
    const source = await readFile(absolute, "utf8");
    const links = /(?:src="|\[[^\]]+\]\()(\.?\.?\/[^)"#]+)(?:#[^)"\s]+)?/g;

    for (const match of source.matchAll(links)) {
      const target = resolve(dirname(absolute), match[1]);
      await assert.doesNotReject(() => readFile(target), `${path}: ${match[1]}`);
    }
  }
});
