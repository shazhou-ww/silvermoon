import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";

import { runCli } from "../../bin/silvermoon.js";
import { ideaPaths } from "../../src/foundation/coordinates/index.js";
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
    withRemote: false,
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
    assert.deepEqual(Object.keys(report).sort(), [
      "actions",
      "intention",
      "observation",
      "response",
    ]);
    assert.equal(report.observation.state, "check-unavailable");
    assert.equal(report.observation.problems[0].type, "commit-unavailable");
  } finally {
    await rm(repository.base, { recursive: true, force: true });
  }
});

test("writes schema-valid domain and telemetry events without changing the report", async () => {
  const repository = await createRepository({
    prefix: "silvermoon-cli-trace-",
    withRemote: true,
  });
  const requestedTracePath = join(repository.root, "whats-next");
  const tracePath = `${requestedTracePath}.trace.jsonl`;
  try {
    const baselineLogs = [];
    const baselineResult = await runCli(
      [
        "whats-next",
        "fixture",
        "--language",
        "ZH-cn",
        "--root",
        repository.root,
        "--json",
      ],
      {
        error: () => {},
        log: (value) => baselineLogs.push(value),
      },
    );
    assert.equal(baselineResult, 0);

    const logs = [];
    const errors = [];
    const result = await runCli(
      [
        "whats-next",
        "fixture",
        "--language",
        "ZH-cn",
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
    assert.equal(report.intention.args.language, "zh-CN");
    assert.equal(report.observation.outputLanguage, "zh-CN");
    assert.deepEqual(report, JSON.parse(baselineLogs[0]));

    const events = (await readFile(tracePath, "utf8"))
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    const traceSchema = JSON.parse(
      await readFile(
        new URL("../../schema/v2/trace-event.schema.json", import.meta.url),
        "utf8",
      ),
    );
    const validateTraceEvent = new Ajv2020({
      allErrors: true,
      strict: true,
    }).compile(traceSchema);
    for (const event of events) {
      assert.equal(
        validateTraceEvent(event),
        true,
        JSON.stringify(validateTraceEvent.errors),
      );
    }
    assert.deepEqual(
      events.map(({ sequence }) => sequence),
      Array.from({ length: events.length }, (_, index) => index + 1),
    );
    assert.equal(events[0].event, "span-start");
    assert.equal(events[0].name, "command.whats-next");
    assert.equal(events[0].attributes.outputLanguage, "zh-CN");
    assert.equal(events[0].attributes.outputRenderer, "json");
    assert.equal(events.at(-1).event, "span-end");
    assert.equal(events.at(-1).name, "trace.flush");
    assert.equal(events.at(-1).parentSpanId, null);
    const commandEnd = events.find(({ event, name }) =>
      event === "span-end" && name === "command.whats-next"
    );
    const renderStart = events.find(({ event, name }) =>
      event === "span-start" && name === "output.render"
    );
    const renderEnd = events.find(({ event, name }) =>
      event === "span-end" && name === "output.render"
    );
    assert.equal(renderStart.parentSpanId, events[0].spanId);
    assert.equal(renderStart.attributes.renderer, "json");
    assert.ok(renderEnd.sequence < commandEnd.sequence);
    assert.ok(commandEnd.sequence < events.at(-1).sequence);
    assert.ok(events.some(({ name }) => name === "snapshot.observe"));
    assert.ok(events.some(({ name }) => name === "project.observe"));
    assert.ok(events.some(({ name }) => name === "device.observe"));
    assert.ok(events.some(({ name }) => name === "idea-layout.inspect"));
    assert.ok(events.some(({ name }) =>
      name === "repository.assess-readiness"
    ));
    const domainEvents = events.filter(({ channel }) => channel === "domain");
    assert.deepEqual(
      domainEvents.map(({ messageSequence }) => messageSequence),
      Array.from({ length: domainEvents.length }, (_, index) => index + 1),
    );
    assert.equal(domainEvents[0].event, "intention.accepted");
    assert.equal(domainEvents.at(-1).event, "response.created");
    const requestedAction = domainEvents.find(({ event }) =>
      event === "action.requested"
    );
    const finishedAction = domainEvents.find(({ event }) =>
      event === "action.finished"
    );
    assert.equal(requestedAction.actionId, finishedAction.actionId);
    assert.ok(events.some(({ channel, event, name, attributes }) =>
      channel === "telemetry"
      && event === "span-start"
      && name === `action.${requestedAction.actionType}`
      && attributes.actionId === requestedAction.actionId
    ));
    assert.doesNotMatch(
      events.map((event) => JSON.stringify(event)).join("\n"),
      /"idea":"fixture"|"root":/,
    );
    const gitSubcommands = events
      .filter(({ event, name }) =>
        event === "span-start" && name === "git.command"
      )
      .map(({ attributes }) => attributes.subcommand);
    assert.ok(gitSubcommands.includes("fetch"));
    assert.equal(gitSubcommands.includes("check-ref-format"), false);
    assert.equal(gitSubcommands.includes("ls-remote"), false);
  } finally {
    await rm(repository.base, { recursive: true, force: true });
  }
});

test("executable traces include bootstrap-to-dispatch duration", async () => {
  const repository = await createRepository({
    prefix: "silvermoon-cli-bootstrap-",
    withRemote: false,
  });
  const tracePath = join(repository.root, "bootstrap.trace.jsonl");
  try {
    const result = spawnSync(
      process.execPath,
      [
        join(repositoryRoot, "bin", "silvermoon.js"),
        "list-ideas",
        "--root",
        repository.root,
        "--trace",
        tracePath,
        "--json",
      ],
      { encoding: "utf8", windowsHide: true },
    );
    assert.equal(result.status, 0, result.stderr);
    const events = (await readFile(tracePath, "utf8"))
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    const commandStart = events.find(
      ({ event, name }) =>
        event === "span-start" && name === "command.list-ideas",
    );
    assert.ok(commandStart.attributes.bootstrapDurationMs >= 0);
    assert.equal(commandStart.attributes.outputRenderer, "json");
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
    withRemote: false,
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
  const repository = await createRepository({
    prefix: "silvermoon-hook-",
    withRemote: false,
  });
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
