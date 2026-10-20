import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CHANGE_SAMPLE_BYTE_LIMIT,
  CHANGE_SAMPLE_ITEM_LIMIT,
  summarizeWorktreeChanges,
} from "../../src/business/whats-next.ts";

test("bounds worktree path samples by item count and UTF-8 bytes", () => {
  const changes = {
    conflicted: [{ path: "冲突.md" }],
    staged: Array.from({ length: 20 }, (_, index) => ({
      path: `staged-${String(index).padStart(2, "0")}.txt`,
    })),
    unstaged: [{ path: "unstaged.txt" }],
    untracked: [{ path: "untracked.txt" }],
  };

  const summary = summarizeWorktreeChanges(changes);
  const entries = [...summary.matchAll(
    /(conflicted|staged|unstaged|untracked) `([^`]+)`/g,
  )].map(([, kind, path]) => `${kind}:${path}`);
  assert.ok(entries.length <= CHANGE_SAMPLE_ITEM_LIMIT);
  assert.ok(Buffer.byteLength(entries.join(", "), "utf8") <= CHANGE_SAMPLE_BYTE_LIMIT);
  const omitted = /(\d+) additional paths are not shown\.$/.exec(summary);
  assert.ok(omitted?.[1]);
  assert.equal(Number(omitted[1]), 23 - entries.length);
  assert.match(
    summary,
    /1 conflicted change, 20 staged changes, 1 unstaged change, 1 untracked change/,
  );
  const firstEntry = entries[0];
  assert.ok(firstEntry);
  assert.match(firstEntry, /^conflicted:/);
});

test("uses a deterministic empty sample when all paths exceed the byte budget", () => {
  const summary = summarizeWorktreeChanges({
    conflicted: [],
    staged: [],
    unstaged: [],
    untracked: [{ path: "界".repeat(CHANGE_SAMPLE_BYTE_LIMIT) }],
  });

  assert.equal(
    summary,
    "The worktree contains 1 untracked change. 1 additional path is not shown.",
  );
});
