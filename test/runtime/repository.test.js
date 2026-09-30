import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

import { validBranchName } from "../../src/repository.js";

const BRANCH_NAME_CORPUS = [
  "",
  "@",
  "-main",
  ".main",
  ".",
  "..",
  "/main",
  "main/",
  "main.",
  "main..next",
  "main@{1}",
  "main~1",
  "main^1",
  "main:next",
  "main?next",
  "main*next",
  "main[next",
  "main\\next",
  "main next",
  "main\tnext",
  "main\nnext",
  "main\u007fnext",
  "feature//safe",
  "feature/.hidden",
  "feature/name.",
  "feature/name.lock",
  "feature/name.lock/next",
  "main",
  "HEAD",
  "head",
  "FETCH_HEAD",
  "ORIG_HEAD",
  "MERGE_HEAD",
  "AUTO_MERGE",
  "refs",
  "remotes",
  "feature/safe",
  "feature/name.locked",
  "release/v1.2.3",
  "topic/@name",
  "topic/{name}",
  "topic/UPPER_case-123",
  "feature/性能",
  "refs/heads/main",
  "remotes/origin/main",
];

test("branch validation preserves Git check-ref-format semantics", () => {
  for (const value of BRANCH_NAME_CORPUS) {
    const result = spawnSync("git", ["check-ref-format", "--branch", value], {
      encoding: "utf8",
      windowsHide: true,
    });
    const silvermoonReserved = value === "@"
      || value.startsWith("refs/")
      || value.startsWith("remotes/");
    const expected = result.status === 0 && !silvermoonReserved;
    assert.equal(
      validBranchName(value),
      expected,
      `${JSON.stringify(value)} differs from git check-ref-format --branch`,
    );
  }
});
