import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CHANGE_SAMPLE_BYTE_LIMIT,
  CHANGE_SAMPLE_ITEM_LIMIT,
  summarizeWorktreeChanges,
} from "../../src/application/next.js";

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
  const samples = /\bsamples=\[(.*)\]; omitted=(\d+)$/.exec(summary);

  assert.ok(samples);
  const entries = samples[1].split(", ");
  assert.ok(entries.length <= CHANGE_SAMPLE_ITEM_LIMIT);
  assert.ok(Buffer.byteLength(samples[1], "utf8") <= CHANGE_SAMPLE_BYTE_LIMIT);
  assert.equal(Number(samples[2]), 23 - entries.length);
  assert.match(summary, /conflicted=1, staged=20, unstaged=1, untracked=1/);
  assert.match(entries[0], /^conflicted:/);
});

test("uses a deterministic empty sample when all paths exceed the byte budget", () => {
  const summary = summarizeWorktreeChanges({
    conflicted: [],
    staged: [],
    unstaged: [],
    untracked: [{ path: "界".repeat(CHANGE_SAMPLE_BYTE_LIMIT) }],
  });

  assert.match(summary, /samples=\[none\]; omitted=1$/);
});
