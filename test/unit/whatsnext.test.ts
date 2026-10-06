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
  const samples = /\bsamples=\[(.*)\]; omitted=(\d+)$/.exec(summary);

  assert.ok(samples);
  const sampleText = samples[1];
  const omittedText = samples[2];
  assert.ok(sampleText);
  assert.ok(omittedText);
  const entries = sampleText.split(", ");
  assert.ok(entries.length <= CHANGE_SAMPLE_ITEM_LIMIT);
  assert.ok(Buffer.byteLength(sampleText, "utf8") <= CHANGE_SAMPLE_BYTE_LIMIT);
  assert.equal(Number(omittedText), 23 - entries.length);
  assert.match(summary, /conflicted=1, staged=20, unstaged=1, untracked=1/);
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

  assert.match(summary, /samples=\[none\]; omitted=1$/);
});
