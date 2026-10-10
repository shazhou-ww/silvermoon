import assert from "node:assert/strict";
import { test } from "node:test";

import { whatsNextTemplates } from "../../src/foundation/report/templates/whats-next/index.ts";

test("what's next templates select a catalog by language", () => {
  assert.equal(
    whatsNextTemplates("en-US")["idea-not-found"]({ selector: "missing" }),
    "Idea missing does not match an observed ULID or unique alias.",
  );
  assert.equal(
    whatsNextTemplates("zh-CN")["idea-not-found"]({ selector: "missing" }),
    "Idea missing 未匹配任何已观察到的 ULID 或唯一 alias。",
  );
  assert.equal(
    whatsNextTemplates("zh-Hans")["navigation-ready"]({
      hasActiveIdea: false,
    }),
    [
      "请明确选择继续一个 active idea，或创建一个新 idea。",
      "当前没有 active idea。",
      "如需继续，运行 `silvermoon whats-next <ULID-or-alias>`；如需开始其他工作，先讨论目标，再运行 `silvermoon create-idea`。",
    ].join("\n"),
  );
});

test("what's next templates render dynamic repository values", () => {
  const templates = whatsNextTemplates("en-US");
  assert.deepEqual(
    templates["primary-behind"]({
      branch: "topic",
      head: "abc123",
      mergeCommand: "`git merge --ff-only def456`",
      primary: "def456",
      primaryBranch: "main",
      recheckCommand: "`silvermoon whats-next`",
      remote: "origin",
    }),
    {
      summary:
        "Local HEAD is abc123; observed primary is def456; relationship is behind.",
      instructions:
        "Fast-forward branch topic to observed primary def456 with `git merge --ff-only def456` without rewriting history, then run `silvermoon whats-next` again.",
    },
  );
});
