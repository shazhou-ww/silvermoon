import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile, rm, writeFile } from "node:fs/promises";
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

test("writes task and Git spans without changing the observed worktree", async () => {
  const repository = await createRepository({
    prefix: "silvermoon-cli-trace-",
  });
  const requestedTracePath = join(repository.root, "whats-next");
  const tracePath = `${requestedTracePath}.trace.jsonl`;
  try {
    const logs = [];
    const errors = [];
    const result = await runCli(
      [
        "whats-next",
        "fixture",
        "--root",
        repository.root,
        "--trace",
        requestedTracePath,
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
    assert.deepEqual(report.observation.problems, []);

    const events = (await readFile(tracePath, "utf8"))
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    assert.equal(events[0].event, "span-start");
    assert.equal(events[0].name, "command.whats-next");
    assert.equal(events.at(-1).event, "span-end");
    assert.equal(events.at(-1).name, "command.whats-next");
    assert.ok(events.some(({ name }) => name === "snapshot.observe"));
    assert.ok(events.some(({ name }) => name === "adoption.inspect"));
    assert.ok(events.some(({ name }) => name === "user-config.load"));
    assert.ok(events.some(({ name }) => name === "idea-layout.inspect"));
    assert.ok(events.some(({ name }) =>
      name === "repository.assess-readiness"
    ));
    const gitSubcommands = events
      .filter(({ event, name }) =>
        event === "span-start" && name === "git.command"
      )
      .map(({ attributes }) => attributes.subcommand);
    assert.ok(gitSubcommands.includes("fetch"));
    assert.equal(gitSubcommands.includes("ls-remote"), false);
  } finally {
    await rm(repository.base, { recursive: true, force: true });
  }
});

test("repository ignore rules cover only the trace JSONL convention", () => {
  const ignored = spawnSync(
    "git",
    [
      "-C",
      repositoryRoot,
      "check-ignore",
      "--no-index",
      "--quiet",
      "logs/whats-next.trace.jsonl",
    ],
    { encoding: "utf8", windowsHide: true },
  );
  assert.equal(ignored.status, 0, ignored.stderr);

  const ordinary = spawnSync(
    "git",
    [
      "-C",
      repositoryRoot,
      "check-ignore",
      "--no-index",
      "--quiet",
      "logs/whats-next.jsonl",
    ],
    { encoding: "utf8", windowsHide: true },
  );
  assert.equal(ordinary.status, 1, ordinary.stderr);
});

test("checks the normalized trace target before running the command", async () => {
  const repository = await createRepository({
    prefix: "silvermoon-cli-trace-existing-",
  });
  const requestedTracePath = join(repository.root, "existing");
  const tracePath = `${requestedTracePath}.trace.jsonl`;
  await writeFile(tracePath, "preserve me\n");
  try {
    const logs = [];
    const errors = [];

    const result = await runCli(
      [
        "whats-next",
        "--root",
        repository.root,
        "--trace",
        requestedTracePath,
        "--json",
      ],
      {
        error: (value) => errors.push(value),
        log: (value) => logs.push(value),
      },
    );

    assert.equal(result, 1);
    assert.deepEqual(logs, []);
    assert.match(errors[0], /Trace file already exists/);
    assert.equal(await readFile(tracePath, "utf8"), "preserve me\n");
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
