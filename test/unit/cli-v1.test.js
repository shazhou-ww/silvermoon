import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createProgram,
  normalizeTraceFileName,
  render,
  runCli,
} from "../../src/cli.js";

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

function envelope() {
  return {
    intention: {
      command: "whats-next",
      args: { idea: null },
    },
    observation: {
      state: "task-pending",
      root: "C:\\repository",
      version: { type: "worktree" },
      configuration: {
        primaryRepository: "https://example.test/owner/repository.git",
        primaryBranch: "main",
        preferredLanguage: "en-US",
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
        }],
      },
      problems: [],
    },
    outcomes: [],
    instructions: "Choose an idea or run `silvermoon create-idea`.",
  };
}

test("registers only the approved command surface", () => {
  const program = createProgram(capture().io);
  assert.deepEqual(
    program.commands.map((command) => command.name()).sort(),
    ["check", "create-idea", "whats-next"],
  );
  const create = program.commands.find((command) =>
    command.name() === "create-idea"
  );
  assert.ok(create.options.some(({ long }) => long === "--language"));
  for (const command of program.commands) {
    assert.ok(command.options.some(({ long }) => long === "--trace"));
  }
  for (const name of ["check", "whats-next"]) {
    const command = program.commands.find((candidate) => candidate.name() === name);
    assert.ok(!command.options.some(({ long }) => long === "--language"));
  }
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

test("help lists exactly the three public subcommands", async () => {
  const { io, logs } = capture();

  assert.equal(await runCli(["--help"], io), 0);
  const help = logs.join("\n");
  assert.match(help, /\bcheck\b/);
  assert.match(help, /\bcreate-idea\b/);
  assert.match(help, /\bwhats-next\b/);
  assert.match(help, /whats-next\.trace\.jsonl/);
  assert.doesNotMatch(help, /help \[command\]|\bwhatsnext\b|\bnewidea\b|\bnew-idea\b/);

  const command = capture();
  assert.equal(await runCli(["whats-next", "--help"], command.io), 0);
  assert.match(command.logs.join("\n"), /--trace <file\.trace\.jsonl>/);
});

test("renders JSON verbatim and omits the empty outcomes section in Markdown", () => {
  const report = envelope();
  const json = capture();
  const human = capture();

  render(report, true, json.io);
  render(report, false, human.io);

  assert.deepEqual(JSON.parse(json.logs[0]), report);
  const text = human.logs[0];
  assert.match(text, /^## Current instruction\n\nDetermine the available next work\.\n\n/);
  assert.match(text, /\n\n## Project status\n\n/);
  assert.match(text, /\n\n### Ideas you can continue\n\n- `01M36QGPNTXEPP61DA4KP4AVZF` preparing/);
  assert.doesNotMatch(text, /### Issues to address/);
  assert.doesNotMatch(text, /Actions and results|No repository side effect was attempted/);
  assert.match(text, /\n\n## Suggested next steps\n\n/);
  assert.match(text, /`01M36QGPNTXEPP61DA4KP4AVZF` preparing/);
  assert.doesNotMatch(text, /undefined|\(\)/);
  assert.match(text, /Choose an idea or run/);
});

test("uses localized section headings from resolved configuration", () => {
  const report = envelope();
  report.observation.configuration.preferredLanguage = "zh-CN";
  report.outcomes.push({
    type: "fetch-primary",
    status: "success",
    summary: "已 fetch primary。",
  });
  const output = capture();

  render(report, false, output.io);

  assert.match(output.logs[0], /^## 本次指示\n\n查看当前可推进的工作。\n\n/);
  assert.match(output.logs[0], /\n\n## 项目现状\n\n/);
  assert.match(output.logs[0], /\n\n### 可继续推进的想法\n\n/);
  assert.match(output.logs[0], /\n\n## 本次操作及结果\n\n- 成功 \[fetch-primary\]/);
  assert.match(output.logs[0], /\n\n## 下一步建议\n\n/);
});

test("renders observed problems under their own level-three heading", () => {
  const report = envelope();
  report.observation.state = "repository-sync-required";
  report.observation.problems.push({
    type: "worktree-changes",
    summary: "One untracked path.",
  });
  const output = capture();
  render(report, false, output.io);
  assert.match(output.logs[0], /\n\n### Ideas you can continue\n\n/);
  assert.match(output.logs[0], /\n\n### Issues to address\n\n- \[worktree-changes\] One untracked path\./);
});

test("renders check as a verdict without dialogue actions or instructions", () => {
  const report = {
    intention: { command: "check", args: { target: { type: "staged" } } },
    observation: {
      state: "project-setup-required",
      observedThrough: "version",
      root: "C:\\repository",
      version: { type: "staged" },
      problems: [{ type: "config-missing", summary: "Missing configuration." }],
    },
  };
  const output = capture();
  render(report, false, output.io);
  assert.match(output.logs[0], /^## Check\n\n- Target: `staged`/);
  assert.match(output.logs[0], /- Result: invalid or unavailable/);
  assert.match(output.logs[0], /\n\n### Issues to address\n\n- \[config-missing\] Missing configuration/);
  assert.doesNotMatch(output.logs[0], /## Suggested next steps|## Actions and results/);
});

test("rejects conflicting targets and invalid language as CLI usage errors", async () => {
  const first = capture();
  const second = capture();

  assert.equal(
    await runCli(["check", "--remote", "--worktree"], first.io),
    2,
  );
  assert.equal(
    await runCli(["create-idea", "--language", "en_US"], second.io),
    2,
  );
  assert.ok(first.errors.length > 0);
  assert.ok(second.errors.length > 0);
});
