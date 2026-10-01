import { readFileSync } from "node:fs";
import {
  Command,
  CommanderError,
  InvalidArgumentError,
  Option,
} from "commander";

import {
  canonicalizeLanguageTag,
  canonicalizeOutputLanguage,
} from "./language.js";
import { normalizeIdeaQuery } from "./idea-query.js";
import { listIdeas } from "./list-ideas.js";
import { checkRepository } from "./index.js";
import { createIdea } from "./create-idea.js";
import { eventCommand } from "./event-command.js";
import { renderResponse } from "./response.js";
import { traceAsync, withTraceFile } from "./trace.js";
import { whatsNext } from "./whatsnext.js";

const { version: VERSION } = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);

const TRACE_FILE_SUFFIX = ".trace.jsonl";
const AUDIENCES = ["human", "agent"];

function write(method, value) {
  const text = value.replace(/\n$/, "");
  if (text) method(text);
}

export function normalizeTraceFileName(value) {
  return value.endsWith(TRACE_FILE_SUFFIX)
    ? value
    : `${value}${TRACE_FILE_SUFFIX}`;
}

function addCommonOptions(command) {
  return command
    .option("--json", "serialize all four command projections as JSON")
    .addOption(
      new Option(
        "--audience <audience>",
        "select human TUI or agent Markdown output (default: human)",
      )
        .choices(AUDIENCES)
        .conflicts("json"),
    )
    .option(
      "--trace <file.trace.jsonl>",
      "write domain and timing events as JSONL (suffix is appended when omitted)",
      normalizeTraceFileName,
    )
    .option("-r, --root <path>", "repository root", process.cwd());
}

export function selectOutputRenderer({
  audience = "human",
  json = false,
  stdinIsTTY = false,
  stdoutIsTTY = false,
}) {
  if (json) return "json";
  if (audience === "human" && stdinIsTTY && stdoutIsTTY) return "tui";
  return "markdown";
}

async function defaultTuiRenderer(content, terminal) {
  const { renderTuiMarkdown } = await import("./tui.js");
  await renderTuiMarkdown(content, terminal);
}

export async function render(
  report,
  { audience = "human", json = false } = {},
  io = console,
  {
    renderTui = defaultTuiRenderer,
    terminal = { stdin: process.stdin, stdout: process.stdout },
  } = {},
) {
  const renderer = selectOutputRenderer({
    audience,
    json,
    stdinIsTTY: terminal.stdin.isTTY === true,
    stdoutIsTTY: terminal.stdout.isTTY === true,
  });
  if (renderer === "json") {
    io.log(JSON.stringify(report, null, 2));
    return;
  }

  const markdown = renderResponse(report.response);
  if (renderer === "tui") {
    await renderTui(markdown, terminal);
    return;
  }
  io.log(markdown);
}

function outputRenderer(options, runtime) {
  const terminal = runtime.terminal ?? {
    stdin: process.stdin,
    stdout: process.stdout,
  };
  return selectOutputRenderer({
    audience: options.audience,
    json: options.json,
    stdinIsTTY: terminal.stdin.isTTY === true,
    stdoutIsTTY: terminal.stdout.isTTY === true,
  });
}

function bootstrapDuration(runtime) {
  if (typeof runtime.bootstrapStartedAt !== "bigint") return {};
  const elapsed = process.hrtime.bigint() - runtime.bootstrapStartedAt;
  return {
    bootstrapDurationMs: Math.round(Number(elapsed) / 1_000) / 1_000,
  };
}

async function runCommand({
  attributes,
  execute,
  name,
  options,
}, io, runtime) {
  const renderer = outputRenderer(options, runtime);
  const traceAttributes = {
    ...attributes,
    outputRenderer: renderer,
    ...bootstrapDuration(runtime),
  };
  if (renderer === "tui") {
    const report = await withTraceFile(
      options.trace,
      name,
      traceAttributes,
      execute,
    );
    await render(report, options, io, runtime);
    return report;
  }
  return withTraceFile(
    options.trace,
    name,
    traceAttributes,
    async () => {
      const report = await execute();
      await traceAsync(
        "output.render",
        { renderer },
        () => render(report, options, io, runtime),
      );
      return report;
    },
  );
}

function contentLanguageArgument(value) {
  try {
    return canonicalizeLanguageTag(value);
  } catch (caught) {
    throw new InvalidArgumentError(caught.message);
  }
}

function outputLanguageArgument(value) {
  try {
    return canonicalizeOutputLanguage(value);
  } catch (caught) {
    throw new InvalidArgumentError(caught.message);
  }
}

function collectOption(value, previous = []) {
  return [...previous, value];
}

export function createProgram(io = console, runtime = {}) {
  const program = new Command();
  program
    .name("silvermoon")
    .description("Derive and validate repository-owned idea state.")
    .version(VERSION, "-v, --version", "display the installed version")
    .addHelpCommand(false)
    .showHelpAfterError("(run with --help for usage)")
    .showSuggestionAfterError()
    .configureHelp({ sortOptions: true, sortSubcommands: true })
    .configureOutput({
      outputError: (value, output) => output(value),
      writeErr: (value) => write(io.error, value),
      writeOut: (value) => write(io.log, value),
    })
    .exitOverride()
    .addHelpText("after", `
Examples:
  $ silvermoon list-ideas
  $ silvermoon list-ideas --language zh-CN
  $ silvermoon list-ideas --state completed --sort oldest --limit 10
  $ silvermoon whats-next
  $ silvermoon whats-next <idea>
  $ silvermoon whats-next <idea> --language zh-CN
  $ silvermoon whats-next <idea> --audience agent
  $ silvermoon whats-next <idea> --json
  $ silvermoon whats-next <idea> --trace whats-next.trace.jsonl
  $ silvermoon create-idea
  $ silvermoon check
  $ silvermoon check --language en-US
  $ silvermoon check --worktree
  $ silvermoon check --staged
  $ silvermoon check --commit HEAD
  $ silvermoon check --remote`);

  addCommonOptions(
    program
      .command("list-ideas")
      .description("query the current local idea inventory")
      .option(
        "--language <tag>",
        "use a built-in output language (en, en-US, zh, or zh-CN) for this invocation",
        outputLanguageArgument,
      )
      .option(
        "--state <state>",
        "include a lifecycle state or active (repeatable)",
        collectOption,
      )
      .option("--all", "include all five lifecycle states")
      .option("--query <text>", "match ID, alias, or title literally")
      .option(
        "--created-since <timestamp>",
        "include ideas created at or after an RFC 3339 timestamp",
      )
      .option(
        "--created-before <timestamp>",
        "include ideas created before an RFC 3339 timestamp",
      )
      .option("--sort <order>", "sort by creation time: newest or oldest")
      .option("--limit <count>", "return at most this positive number of ideas"),
  ).action(async (options) => {
    const query = normalizeIdeaQuery({
      all: options.all,
      createdBefore: options.createdBefore,
      createdSince: options.createdSince,
      limit: options.limit,
      query: options.query,
      sort: options.sort,
      states: options.state,
    });
    const report = await runCommand({
      name: "command.list-ideas",
      options,
      attributes: {
        command: "list-ideas",
        hasQuery: query.query !== null,
        outputLanguage: options.language ?? null,
        stateCount: query.states.length,
      },
      execute: () => listIdeas({
        ...query,
        language: options.language,
        root: options.root,
      }),
    }, io, runtime);
    program.setOptionValue(
      "resultCode",
      report.observation.state === "ideas-listed" ? 0 : 1,
    );
  });

  addCommonOptions(
    program
      .command("whats-next [idea]")
      .description("observe project, repository, and idea readiness")
      .option(
        "--language <tag>",
        "use a built-in output language (en, en-US, zh, or zh-CN) for this invocation",
        outputLanguageArgument,
      ),
  ).action(async (idea, options) => {
    const report = await runCommand({
      name: "command.whats-next",
      options,
      attributes: {
        command: "whats-next",
        outputLanguage: options.language ?? null,
      },
      execute: () => whatsNext({
        idea,
        language: options.language,
        root: options.root,
      }),
    }, io, runtime);
    program.setOptionValue("resultCode", 0);
  });

  addCommonOptions(
    program
      .command("create-idea")
      .description("create one structured idea scaffold after readiness checks")
      .option(
        "--language <tag>",
        "persist a canonical content language override on the new idea",
        contentLanguageArgument,
      ),
  ).action(async (options) => {
    const report = await runCommand({
      name: "command.create-idea",
      options,
      attributes: {
        command: "create-idea",
        contentLanguage: options.language ?? null,
      },
      execute: () => createIdea({
        language: options.language,
        root: options.root,
      }),
    }, io, runtime);
    program.setOptionValue("resultCode", 0);
  });

  addCommonOptions(
    program
      .command("check")
      .description("validate Silvermoon configuration and idea state")
      .option(
        "--language <tag>",
        "use a built-in output language (en, en-US, zh, or zh-CN) for this invocation",
        outputLanguageArgument,
      )
      .addOption(new Option("--remote", "fetch and validate the configured primary tip").conflicts(["commit", "staged", "worktree"]))
      .addOption(new Option("--commit <revision>", "validate one local commit snapshot").conflicts(["remote", "staged", "worktree"]))
      .addOption(new Option("--staged", "validate the index snapshot").conflicts(["remote", "commit", "worktree"]))
      .addOption(new Option("--worktree", "validate HEAD plus staged, unstaged, and untracked changes").conflicts(["remote", "commit", "staged"])),
  ).action(async (options) => {
    const report = await runCommand({
      name: "command.check",
      options,
      attributes: {
        command: "check",
        outputLanguage: options.language ?? null,
      },
      execute: () => checkRepository({
        commit: options.commit,
        language: options.language,
        remote: options.remote,
        root: options.root,
        staged: options.staged,
        worktree: options.worktree,
      }),
    }, io, runtime);
    program.setOptionValue(
      "resultCode",
      report.observation.state === "project-ready" ? 0 : 1,
    );
  });

  addCommonOptions(
    program.command("event <operation> [idea]")
      .description("replay, append, revise, or recover v2 idea events")
      .option("--language <tag>", "use a built-in output language for this invocation", outputLanguageArgument)
      .option("--input <file>", "JSON business request, or request array for revise (no sequence)")
      .option("--expected-length <bytes>", "observed log byte length", (value) => {
        if (!/^(0|[1-9][0-9]*)$/.test(value) || !Number.isSafeInteger(Number(value))) {
          throw new InvalidArgumentError("expected length must be a nonnegative safe integer");
        }
        return Number(value);
      })
      .option("--expected-digest <sha256>", "observed exact log digest")
      .option("--expected-primary <commit>", "observed primary commit (never stored in events)")
      .option("--confirm-decision", "assert an explicit human decision for this exact request")
      .option("--owned-suffix", "confirm ownership and review of the candidate suffix being replaced")
      .option("--confirm-stopped", "confirm the interrupted transaction writer has stopped")
      .option("--rollback", "restore transaction sources instead of completing it"),
  ).action(async (operation, idea, options) => {
    if (!["replay", "append", "revise", "recover"].includes(operation)
      || (operation !== "recover" && !idea)
      || (operation === "recover" && idea)
      || (["append", "revise"].includes(operation) && !options.input)
      || (["replay", "recover"].includes(operation) && options.input)
      || (operation !== "recover" && (options.rollback || options.confirmStopped))
      || (operation !== "revise" && options.ownedSuffix)
      || (["replay", "recover"].includes(operation) && [
        options.expectedLength, options.expectedDigest, options.expectedPrimary, options.confirmDecision,
      ].some((value) => value !== undefined))) {
      throw Object.assign(new Error("Use event replay|append|revise <idea>, or event recover; writes require --input."), { exitCode: 2 });
    }
    let input;
    if (options.input) {
      try { input = JSON.parse(readFileSync(options.input, "utf8")); }
      catch (cause) { throw Object.assign(new Error(`Cannot read business request: ${cause.message}`), { exitCode: 2 }); }
    }
    const report = await runCommand({
      name: "command.event", options, attributes: { command: "event", operation },
      execute: () => eventCommand({ ...options, operation, idea, input }),
    }, io, runtime);
    program.setOptionValue("resultCode", report.observation.state === "event-result"
      && report.observation.receipt.reduction?.ok !== false
      && report.observation.receipt.format?.ok !== false ? 0 : 1);
  });
  return program;
}

export async function runCli(args, io = console, runtime = {}) {
  const program = createProgram(io, runtime);
  try {
    await program.parseAsync(args.length === 0 ? ["--help"] : args, { from: "user" });
  } catch (caught) {
    if (caught instanceof CommanderError) return caught.exitCode === 0 ? 0 : 2;
    if (caught.exitCode === 2) {
      io.error(`ERROR usage: ${caught.message}`);
      return 2;
    }
    io.error(`ERROR command.failed: ${caught.message}`);
    return 1;
  }
  return program.getOptionValue("resultCode") ?? 0;
}
