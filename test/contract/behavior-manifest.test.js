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
  "inventory-readiness",
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
    readFile(new URL("../integration/create-idea.test.js", import.meta.url), "utf8"),
    readFile(new URL("../integration/list-ideas.test.js", import.meta.url), "utf8"),
    readFile(new URL("../integration/whatsnext-setup.test.js", import.meta.url), "utf8"),
    readFile(new URL("../integration/whatsnext-selection.test.js", import.meta.url), "utf8"),
    readFile(new URL("../integration/whatsnext-readiness.test.js", import.meta.url), "utf8"),
    readFile(new URL("../integration/whatsnext-guidance.test.js", import.meta.url), "utf8"),
  ]);
  const actual = [];
  for (const source of sources) {
    for (const title of source.matchAll(/test\("([^"]+)"/g)) {
      for (const tag of title[1].matchAll(/\[([a-z][a-z-]+)\]/g)) {
        actual.push(tag[1]);
      }
    }
  }

  assert.deepEqual(actual.sort(), expected);
});