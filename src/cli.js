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
import { renderResponse } from "./response.js";
import { withTraceFile } from "./trace.js";
import { whatsNext } from "./whatsnext.js";

const { version: VERSION } = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);

const TRACE_FILE_SUFFIX = ".trace.jsonl";

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
    .option(
      "--trace <file.trace.jsonl>",
      "write domain and timing events as JSONL (suffix is appended when omitted)",
      normalizeTraceFileName,
    )
    .option("-r, --root <path>", "repository root", process.cwd());
}

export function render(report, json, io) {
  io.log(
    json
      ? JSON.stringify(report, null, 2)
      : renderResponse(report.response),
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

export function createProgram(io = console) {
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
  $ silvermoon list-ideas --state completed --sort oldest --limit 10
  $ silvermoon whats-next
  $ silvermoon whats-next <idea>
  $ silvermoon whats-next <idea> --language zh-CN
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
    const report = await withTraceFile(
      options.trace,
      "command.list-ideas",
      {
        command: "list-ideas",
        hasQuery: query.query !== null,
        stateCount: query.states.length,
      },
      () => listIdeas({
        ...query,
        root: options.root,
      }),
    );
    render(report, options.json, io);
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
        "use a built-in output language (en-US or zh-CN) for this invocation",
        outputLanguageArgument,
      ),
  ).action(async (idea, options) => {
    const report = await withTraceFile(
      options.trace,
      "command.whats-next",
      {
        command: "whats-next",
        outputLanguage: options.language ?? null,
      },
      () => whatsNext({
        idea,
        language: options.language,
        root: options.root,
      }),
    );
    render(report, options.json, io);
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
    const report = await withTraceFile(
      options.trace,
      "command.create-idea",
      {
        command: "create-idea",
        contentLanguage: options.language ?? null,
      },
      () => createIdea({
        language: options.language,
        root: options.root,
      }),
    );
    render(report, options.json, io);
    program.setOptionValue("resultCode", 0);
  });

  addCommonOptions(
    program
      .command("check")
      .description("validate Silvermoon configuration and idea state")
      .option(
        "--language <tag>",
        "use a built-in output language (en-US or zh-CN) for this invocation",
        outputLanguageArgument,
      )
      .addOption(new Option("--remote", "fetch and validate the configured primary tip").conflicts(["commit", "staged", "worktree"]))
      .addOption(new Option("--commit <revision>", "validate one local commit snapshot").conflicts(["remote", "staged", "worktree"]))
      .addOption(new Option("--staged", "validate the index snapshot").conflicts(["remote", "commit", "worktree"]))
      .addOption(new Option("--worktree", "validate HEAD plus staged, unstaged, and untracked changes").conflicts(["remote", "commit", "staged"])),
  ).action(async (options) => {
    const report = await withTraceFile(
      options.trace,
      "command.check",
      {
        command: "check",
        outputLanguage: options.language ?? null,
      },
      () => checkRepository({
        commit: options.commit,
        language: options.language,
        remote: options.remote,
        root: options.root,
        staged: options.staged,
        worktree: options.worktree,
      }),
    );
    render(report, options.json, io);
    program.setOptionValue(
      "resultCode",
      report.observation.state === "project-ready" ? 0 : 1,
    );
  });

  return program;
}

export async function runCli(args, io = console) {
  const program = createProgram(io);
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
