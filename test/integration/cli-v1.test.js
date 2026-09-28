import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { runCli } from "../../src/cli.js";
import { ideaPaths } from "../../src/layout.js";
import { createRepository, FIRST_ID, git } from "../helpers/repository.js";

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

test("returns one when check cannot validate a commit", async () => {
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

    assert.equal(result, 1);
    assert.deepEqual(errors, []);
    const report = JSON.parse(logs[0]);
    assert.deepEqual(Object.keys(report).sort(), ["intention", "observation"]);
    assert.equal(report.observation.state, "check-unavailable");
    assert.equal(report.observation.problems[0].type, "commit-unavailable");
  } finally {
    await rm(repository.base, { recursive: true, force: true });
  }
});

test("pre-commit staged check fails while unchanged HEAD passes", async () => {
  const repository = await createRepository({ prefix: "silvermoon-hook-" });
  try {
    const ledger = join(repository.root, ...ideaPaths(FIRST_ID).ledgerPath.split("/"));
    await rm(ledger);
    git(repository.root, "add", "--all");
    const logs = [];
    const io = { error: () => {}, log: (value) => logs.push(value) };
    assert.equal(await runCli(["check", "--root", repository.root, "--json"], io), 0);
    assert.equal(JSON.parse(logs.pop()).observation.state, "project-ready");
    assert.equal(
      await runCli(["check", "--root", repository.root, "--staged", "--json"], io),
      1,
    );
    assert.equal(JSON.parse(logs.pop()).observation.state, "project-setup-required");
  } finally {
    await rm(repository.base, { recursive: true, force: true });
  }
});
