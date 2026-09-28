import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rm } from "node:fs/promises";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { runCli } from "../../src/cli.js";
import { createRepository } from "../helpers/repository.js";

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));

function gitStatus() {
  const result = spawnSync("git", ["-C", repositoryRoot, "status", "--porcelain=v1"], {
    encoding: "utf8",
    windowsHide: true,
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

function capture() {
  return {
    error: () => {},
    log: () => {},
  };
}

test("rejects legacy command spellings without changing the repository", async () => {
  const before = gitStatus();

  for (const command of ["whatsnext", "new", "newidea", "new-idea"]) {
    assert.equal(await runCli([command], capture()), 2, command);
  }
  assert.equal(gitStatus(), before);
});

test("returns zero when check reports a validation finding", async () => {
  const repository = await createRepository({
    prefix: "silvermoon-cli-exit-",
  });
  try {
    const logs = [];
    const errors = [];
    const result = await runCli(
      [
        "check",
        "--commit",
        "missing-revision",
        "--root",
        repository.root,
        "--json",
      ],
      {
        error: (value) => errors.push(value),
        log: (value) => logs.push(value),
      },
    );

    assert.equal(result, 0);
    assert.deepEqual(errors, []);
    const report = JSON.parse(logs[0]);
    assert.equal(report.observation.problems[0].type, "commit-unavailable");
  } finally {
    await rm(repository.base, { recursive: true, force: true });
  }
});
