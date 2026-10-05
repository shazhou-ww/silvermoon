import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createProgram,
  normalizeTraceFileName,
  render,
  runCli,
  selectOutputRenderer,
} from "../../bin/silvermoon.js";
import { CommandRun } from "../../src/foundation/command-message/index.js";

function capture() {
  const logs = [];
  const errors = [];
  return {
    errors,
    io: {
      error: (value) => errors.push(value),
      log: (value) => logs.push(value),
    },
    logs,
  };
}

function terminal(stdinIsTTY = false, stdoutIsTTY = false) {
  return {
    stdin: { isTTY: stdinIsTTY },
    stdout: { isTTY: stdoutIsTTY },
  };
}

function navigationObservation(outputLanguage = "en-US") {
  return {
    state: "navigation-ready",
    root: "C:\\repository",
    version: { type: "worktree" },
    outputLanguage,
    configuration: {
      primaryRepository: "https://example.test/owner/repository.git",
      primaryBranch: "main",
      preferredLanguage: "fr-FR",
    },
    ideas: {
      counts: {
        preparing: 1,
        implementing: 0,
        deploying: 0,
        completed: 2,
        abandoned: 1,
      },
      activeIdeas: [{
        id: "01M36QGPNTXEPP61DA4KP4AVZF",
        state: "preparing",
        createdAt: "2026-09-29T00:00:00.000Z",
        title: "Fixture",
      }],
    },
    problems: [],
  };
}

function reportFor({
  intention = {
    command: "whats-next",
    args: { idea: null, language: null },
  },
  observation = navigationObservation(),
  nextSteps = "Choose an idea or run `silvermoon create-idea`.",
} = {}) {
  return new CommandRun(intention, { eventSink: () => {} })
    .complete(observation, { nextSteps });
}

test("registers only the approved command surface", () => {
  const program = createProgram(capture().io);
  assert.deepEqual(
    program.commands.map((command) => command.name()).sort(),
    ["check", "create-idea", "event", "list-ideas", "whats-next"],
  );
  const create = program.commands.find((command) =>
    command.name() === "create-idea"
  );
  assert.ok(create.options.some(({ long }) => long === "--language"));
  for (const command of program.commands.filter((candidate) =>
    candidate.name() !== "list-ideas"
  )) {
    assert.ok(command.options.some(({ long }) => long === "--audience"));
    assert.ok(command.options.some(({ long }) => long === "--trace"));
    assert.ok(command.options.some(({ long }) => long === "--language"));
  }
  const list = program.commands.find((command) => command.name() === "list-ideas");
  for (const option of [
    "--all",
    "--created-before",
    "--created-since",
    "--limit",
    "--language",
    "--query",
    "--sort",
    "--state",
    "--audience",
    "--trace",
  ]) {
    assert.ok(list.options.some(({ long }) => long === option), option);
  }
  assert.ok(list.options.some(({ long }) => long === "--language"));
});

test("normalizes trace paths to the exact lowercase suffix", () => {
  assert.equal(
    normalizeTraceFileName("logs/whats-next"),
    "logs/whats-next.trace.jsonl",
  );
  assert.equal(
    normalizeTraceFileName("logs/whats-next.trace.jsonl"),
    "logs/whats-next.trace.jsonl",
  );
  assert.equal(
    normalizeTraceFileName("logs/whats-next.TRACE.JSONL"),
    "logs/whats-next.TRACE.JSONL.trace.jsonl",
  );
  assert.equal(
    normalizeTraceFileName("C:\\traces\\check.jsonl"),
    "C:\\traces\\check.jsonl.trace.jsonl",
  );
});

test("help describes the four projections and unified trace", async () => {
  const { io, logs } = capture();

  assert.equal(await runCli(["--help"], io), 0);
  const help = logs.join("\n");
  assert.match(help, /\bcheck\b/);
  assert.match(help, /\bcreate-idea\b/);
  assert.match(help, /\blist-ideas\b/);
  assert.match(help, /\bwhats-next\b/);
  assert.doesNotMatch(help, /help \[command\]|\bwhatsnext\b|\bnewidea\b|\bnew-idea\b/);

  const command = capture();
  assert.equal(await runCli(["whats-next", "--help"], command.io), 0);
  const commandHelp = command.logs.join("\n");
  assert.match(commandHelp, /four command projections/);
  assert.match(commandHelp, /human TUI or agent Markdown/);
  assert.match(commandHelp, /domain and timing events/);
});

test("renders JSON verbatim and default non-TTY output from response only", async () => {
  const report = reportFor();
  const json = capture();
  const human = capture();

  await render(report, { json: true }, json.io);
  await render(report, {}, human.io, { terminal: terminal() });

  assert.deepEqual(JSON.parse(json.logs[0]), report);
  assert.deepEqual(Object.keys(report), [
    "intention",
    "observation",
    "actions",
    "response",
  ]);
  const text = human.logs[0];
  assert.match(text, /^## Choose what to continue\n\n/);
  assert.match(text, /Current state: navigation-ready/);
  assert.match(text, /1 active idea\(s\) are available/);
  assert.match(text, /### Active ideas/);
  assert.match(text, /\| Alias \/ ID \| State \| Created \| Title \|/);
  assert.match(text, /### Next steps/);
  assert.match(text, /Choose an idea or run/);
  assert.doesNotMatch(
    text,
    /Current instruction|Project status|Actions and results|C:\\repository/,
  );
});

test("response rendering uses the observation output language", async () => {
  const report = reportFor({
    observation: navigationObservation("zh-CN"),
    nextSteps: "请选择一个 idea。",
  });
  const output = capture();

  await render(report, {}, output.io, { terminal: terminal() });

  assert.match(output.logs[0], /^## 选择要继续的工作\n\n/);
  assert.match(output.logs[0], /当前状态：navigation-ready/);
  assert.match(output.logs[0], /当前有 1 个 active idea/);
  assert.match(output.logs[0], /### Active ideas/);
  assert.match(output.logs[0], /\| Alias \/ ID \| 状态 \| 创建时间 \| 标题 \|/);
  assert.match(output.logs[0], /### 下一步/);
  assert.doesNotMatch(output.logs[0], /本次指示|项目现状|本次操作及结果/);
});

test("renders selected ideas and validation without internal projections", async () => {
  const selected = reportFor({
    intention: {
      command: "whats-next",
      args: { idea: "fixture", language: null },
    },
    observation: {
      ...navigationObservation(),
      state: "idea-selected",
      selectedIdea: {
        id: "01M36QGPNTXEPP61DA4KP4AVZF",
        alias: "fixture",
        state: "implementing",
      },
      ideas: undefined,
    },
    nextSteps: "Continue the implementation.",
  });
  const selectedOutput = capture();
  await render(selected, {}, selectedOutput.io, { terminal: terminal() });
  assert.match(selectedOutput.logs[0], /^## Next steps/);
  assert.match(selectedOutput.logs[0], /fixture/);
  assert.match(selectedOutput.logs[0], /implementing/);

  const check = reportFor({
    intention: {
      command: "check",
      args: { target: { type: "head" }, language: null },
    },
    observation: {
      ...navigationObservation(),
      state: "project-ready",
    },
    nextSteps: undefined,
  });
  const checkOutput = capture();
  await render(check, {}, checkOutput.io, { terminal: terminal() });
  assert.match(checkOutput.logs[0], /^## Check/);
  assert.match(checkOutput.logs[0], /Result: valid/);
  assert.doesNotMatch(checkOutput.logs[0], /Next steps/);
});

test("selects output rendering from audience and both TTY states", async () => {
  assert.equal(selectOutputRenderer({}), "markdown");
  assert.equal(
    selectOutputRenderer({ stdinIsTTY: true, stdoutIsTTY: true }),
    "tui",
  );
  assert.equal(
    selectOutputRenderer({
      audience: "agent",
      stdinIsTTY: true,
      stdoutIsTTY: true,
    }),
    "markdown",
  );
  assert.equal(
    selectOutputRenderer({ stdinIsTTY: false, stdoutIsTTY: true }),
    "markdown",
  );
  assert.equal(
    selectOutputRenderer({ stdinIsTTY: true, stdoutIsTTY: false }),
    "markdown",
  );
  assert.equal(selectOutputRenderer({ json: true }), "json");

  const report = reportFor();
  const tui = capture();
  const rendered = [];
  await render(report, {}, tui.io, {
    renderTui: async (content, streams) => rendered.push({ content, streams }),
    terminal: terminal(true, true),
  });
  assert.deepEqual(tui.logs, []);
  assert.equal(rendered.length, 1);
  assert.match(rendered[0].content, /^## Choose what to continue/);

  const agent = capture();
  await render(report, { audience: "agent" }, agent.io, {
    renderTui: async () => assert.fail("agent output must not start the TUI"),
    terminal: terminal(true, true),
  });
  assert.equal(agent.logs[0], rendered[0].content);
  assert.doesNotMatch(agent.logs[0], /\x1B\[/);
});

test("rejects conflicting targets, output modes, and invalid values as usage errors", async () => {
  for (const args of [
    ["check", "--remote", "--staged"],
    ["check", "--language", "fr-FR"],
    ["list-ideas", "--language", "fr-FR"],
    ["whats-next", "--language", "fr-FR"],
    ["whats-next", "--audience", "reader"],
    ["whats-next", "--json", "--audience", "agent"],
  ]) {
    const result = capture();
    assert.equal(await runCli(args, result.io), 2);
    assert.equal(result.logs.length, 0);
    assert.ok(result.errors.length > 0);
  }
});
