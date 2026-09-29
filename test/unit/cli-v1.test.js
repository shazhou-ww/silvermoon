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
      args: { idea: null, language: null },
    },
    observation: {
      state: "navigation-ready",
      root: "C:\\repository",
      version: { type: "worktree" },
      outputLanguage: "en-US",
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
    assert.ok(command.options.some(({ long }) => long === "--language"));
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
  assert.match(text, /- content language: en-US/);
  assert.doesNotMatch(text, /- language: en-US/);
  assert.match(text, /\n\n### Ideas you can continue\n\n- `01M36QGPNTXEPP61DA4KP4AVZF` preparing/);
  assert.doesNotMatch(text, /### Issues to address/);
  assert.doesNotMatch(text, /Actions and results|No repository side effect was attempted/);
  assert.match(text, /\n\n## Suggested next steps\n\n/);
  assert.equal(
    text.match(/01M36QGPNTXEPP61DA4KP4AVZF/g)?.length,
    1,
  );
  assert.doesNotMatch(text, /undefined|\(\)/);
  assert.match(text, /Choose an idea or run/);
});

test("uses the observation output language independently of content language", () => {
  const report = envelope();
  report.observation.configuration.preferredLanguage = "fr-FR";
  report.observation.outputLanguage = "zh-CN";
  report.outcomes.push({
    type: "fetch-primary",
    status: "success",
    summary: "已 fetch primary。",
  });
  const output = capture();

  render(report, false, output.io);

  assert.match(output.logs[0], /^## 本次指示\n\n查看当前可推进的工作。\n\n/);
  assert.match(output.logs[0], /\n\n## 项目现状\n\n/);
  assert.match(output.logs[0], /- 内容语言: fr-FR/);
  assert.match(output.logs[0], /\n\n### 可继续推进的想法\n\n/);
  assert.doesNotMatch(output.logs[0], /## 本次操作及结果/);
  assert.match(output.logs[0], /\n\n## 下一步建议\n\n/);
});

test("renders selected and missing ideas without duplicating the navigation inventory", () => {
  const selected = envelope();
  selected.intention.args.idea = "fixture";
  selected.observation = {
    state: "idea-selected",
    root: "C:\\repository",
    version: { type: "worktree" },
    configuration: selected.observation.configuration,
    problems: [],
    selectedIdea: { id: "01M36QGPNTXEPP61DA4KP4AVZF", alias: "fixture", state: "completed" },
  };
  selected.outcomes.push({ type: "fetch-primary", status: "success", summary: "Fetched primary." });
  const output = capture();
  render(selected, false, output.io);
  assert.match(output.logs[0], /Selected idea: `01M36QGPNTXEPP61DA4KP4AVZF` \(fixture\); state: completed/);
  assert.doesNotMatch(output.logs[0], /ideas: preparing|### Ideas you can continue|## Actions and results/);

  const missing = structuredClone(selected);
  missing.observation = {
    ...selected.observation,
    state: "idea-not-found",
    candidates: [{ id: "01M36QGPNTXEPP61DA4KP4AVZF", state: "preparing" }],
  };
  delete missing.observation.selectedIdea;
  const missingOutput = capture();
  render(missing, false, missingOutput.io);
  assert.match(missingOutput.logs[0], /requested idea was not found/);
  assert.match(missingOutput.logs[0], /### Ideas you can continue/);
});

test("retains fetch failures and scaffold results while hiding aligned fetch successes", () => {
  const report = envelope();
  report.observation.state = "idea-created";
  delete report.observation.ideas;
  report.observation.createdIdea = {
    id: "01M36QGPNTXEPP61DA4KP4AVZF",
    path: ".silvermoon/ideas/01M36QGPNTXEPP61DA4KP4AVZF",
    state: "preparing",
  };
  report.outcomes = [
    { type: "fetch-primary", status: "success", summary: "Fetched primary." },
    { type: "create-idea-scaffold", status: "success", summary: "Created idea." },
  ];
  const success = capture();
  render(report, false, success.io);
  assert.match(success.logs[0], /The local repository was ready before creation/);
  assert.match(success.logs[0], /- success \[create-idea-scaffold\]: Created idea\./);
  assert.doesNotMatch(success.logs[0], /Fetched primary/);

  report.observation.state = "repository-sync-required";
  report.observation.problems = [{ type: "primary-fetch-failed", summary: "Network error." }];
  report.outcomes = [{ type: "fetch-primary", status: "failure", summary: "Network error." }];
  const failure = capture();
  render(report, false, failure.io);
  assert.match(failure.logs[0], /- failure \[fetch-primary\]: Network error\./);

  report.observation.problems = [{ type: "primary-behind", summary: "Primary moved." }];
  report.outcomes = [{ type: "fetch-primary", status: "success", summary: "Fetched a newer primary." }];
  const behind = capture();
  render(report, false, behind.io);
  assert.match(behind.logs[0], /- success \[fetch-primary\]: Fetched a newer primary\./);

  report.observation.state = "idea-create-failed";
  report.observation.problems = [];
  report.outcomes = [
    { type: "fetch-primary", status: "success", summary: "Fetched primary." },
    { type: "create-idea-scaffold", status: "failure", summary: "Write failed." },
  ];
  const createFailure = capture();
  render(report, false, createFailure.io);
  assert.match(createFailure.logs[0], /creating the idea failed/);
  assert.match(createFailure.logs[0], /- failure \[create-idea-scaffold\]: Write failed\./);
  assert.doesNotMatch(createFailure.logs[0], /Fetched primary/);
});

test("renders observed problems under their own level-three heading", () => {
  const report = envelope();
  report.observation.state = "repository-sync-required";
  report.observation.problems.push({
    type: "worktree-changes",
    summary: "One untracked path.",
  });

  test("renders create-specific intent and local repository preparation", () => {
    const report = envelope();
    report.intention = { command: "create-idea", args: { language: null } };
    report.observation = {
      state: "repository-preparation-required",
      root: "C:\\repository",
      version: { type: "worktree" },
      configuration: report.observation.configuration,
      problems: [{ type: "worktree-changes", summary: "One untracked path." }],
    };
    const output = capture();

    render(report, false, output.io);

    assert.match(output.logs[0], /^## Current instruction\n\nCreate one new idea and use en-US for natural-language content\./);
    assert.match(output.logs[0], /local repository must be prepared/);
    assert.doesNotMatch(output.logs[0], /Ideas you can continue|ideas: preparing/);
  });
  const output = capture();
  render(report, false, output.io);
  assert.match(output.logs[0], /\n\n### Ideas you can continue\n\n/);
  assert.match(output.logs[0], /\n\n### Issues to address\n\n- \[worktree-changes\] One untracked path\./);
});

test("renders check as a verdict without dialogue actions or instructions", () => {
  const report = {
    intention: {
      command: "check",
      args: { target: { type: "staged" }, language: null },
    },
    observation: {
      state: "project-setup-required",
      observedThrough: "version",
      root: "C:\\repository",
      version: { type: "staged" },
      outputLanguage: "en-US",
      problems: [{ type: "config-missing", summary: "Missing configuration." }],
    },
  };
  const output = capture();
  render(report, false, output.io);
  assert.match(output.logs[0], /^## Check\n\n- Target: `staged`/);
  assert.match(output.logs[0], /- Result: invalid or unavailable/);
  assert.match(output.logs[0], /\n\n### Issues to address\n\n- \[config-missing\] Missing configuration/);
  assert.doesNotMatch(output.logs[0], /## Suggested next steps|## Actions and results/);

  report.intention.args.language = "zh-CN";
  report.observation.outputLanguage = "zh-CN";
  const localized = capture();
  render(report, false, localized.io);
  assert.match(localized.logs[0], /^## 检查\n\n- 目标: `staged`/);
  assert.match(localized.logs[0], /- 结果: 未通过或无法验证/);
});

test("rejects conflicting targets and invalid language as CLI usage errors", async () => {
  const first = capture();
  const second = capture();
  const third = capture();
  const fourth = capture();

  assert.equal(
    await runCli(["check", "--remote", "--worktree"], first.io),
    2,
  );
  assert.equal(
    await runCli(["create-idea", "--language", "en_US"], second.io),
    2,
  );
  assert.equal(
    await runCli(["whats-next", "--language", "fr-FR"], third.io),
    2,
  );
  assert.equal(
    await runCli(["check", "--language", "en"], fourth.io),
    2,
  );
  assert.ok(first.errors.length > 0);
  assert.ok(second.errors.length > 0);
  assert.ok(third.errors.length > 0);
  assert.ok(fourth.errors.length > 0);
});
