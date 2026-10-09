import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const expected = [
  "ahead",
  "alias-absent",
  "behind",
  "branch-mismatch",
  "conflict",
  "create-no-remote",
  "create-primary-branch",
  "create-primary-upstream",
  "dirty",
  "diverged",
  "inventory-cli",
  "inventory-conflict",
  "inventory-default",
  "inventory-empty",
  "inventory-filters",
  "inventory-language",
  "inventory-layout",
  "inventory-metadata-error",
  "inventory-readiness",
  "inventory-title-budget",
  "inventory-usage",
  "inventory-worktree",
  "partial-write-failure",
  "primary-relocation",
  "selector-known",
  "selector-none",
  "selector-unknown",
  "structured-changes",
  "ulid-collision",
  "unrelated-active-create",
];

test("executes the approved behavior case manifest", async () => {
  const sources = await Promise.all([
    readFile(new URL("../integration/create-idea-scaffold.test.ts", import.meta.url), "utf8"),
    readFile(new URL("../integration/create-idea-transactions.test.ts", import.meta.url), "utf8"),
    readFile(new URL("../integration/list-ideas.test.ts", import.meta.url), "utf8"),
    readFile(new URL("../integration/whatsnext-setup.test.ts", import.meta.url), "utf8"),
    readFile(new URL("../integration/whatsnext-readiness.test.ts", import.meta.url), "utf8"),
    readFile(new URL("../integration/whatsnext-guidance.test.ts", import.meta.url), "utf8"),
  ]);
  const actual = [];
  for (const source of sources) {
    for (const title of source.matchAll(/test\("([^"]+)"/g)) {
      const testTitle = title[1];
      if (testTitle === undefined) assert.fail("test title capture is required");
      for (const tag of testTitle.matchAll(/\[([a-z][a-z-]+)\]/g)) {
        const name = tag[1];
        if (name === undefined) assert.fail("behavior tag capture is required");
        actual.push(name);
      }
    }
  }

  assert.deepEqual(actual.sort(), expected);
});