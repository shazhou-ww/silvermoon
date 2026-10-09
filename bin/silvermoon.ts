#!/usr/bin/env node
import { readFileSync, realpathSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  Command,
  CommanderError,
  InvalidArgumentError,
  Option,
} from "commander";

import {
  canonicalizeLanguageTag,
  canonicalizeOutputLanguage,
} from "../src/foundation/language/index.ts";
import { normalizeIdeaQuery } from "../src/foundation/idea-query/index.ts";
import { listIdeas } from "../src/business/index.ts";
import { checkRepository } from "../src/business/index.ts";
import { createIdea } from "../src/business/index.ts";
import { eventCommand } from "../src/business/index.ts";
import { renderResponse } from "../src/foundation/renderer/index.ts";
import { traceAsync, withTraceFile } from "../src/foundation/trace/index.ts";
import { writeTerminalLine } from "../src/foundation/terminal/index.ts";
import { whatsNext } from "../src/business/index.ts";

type Io = { log: (message: unknown) => unknown; error: (message: unknown) => unknown };
type Terminal = {
  stdin: { isTTY?: boolean };
  stdout: { isTTY?: boolean };
};
type CliOptions = {
  afterDigest?: string;
  afterLength?: number;
  all?: boolean;
  audience?: string;
  commit?: string;
  confirmDecision?: boolean;
  createdBefore?: string;
  createdSince?: string;
  expectedDigest?: string;
  expectedLength?: number;
  expectedPrimary?: string;
  fullHistory?: boolean;
  input?: string;
  json?: boolean;
  language?: string;
  limit?: string;
  query?: string;
  remote?: boolean;
  root: string;
  sort?: string;
  staged?: boolean;
  state?: string[];
  trace?: string;
  worktree?: boolean;
};
type Runtime = {
  bootstrapStartedAt?: bigint;
  renderTui?: (content: string, terminal: Terminal) => Promise<void>;
  terminal?: Terminal;
};
type CommandReport = {
  observation: {
    state: string;
    receipt?: {
      reduction?: { ok?: boolean };
      format?: { ok?: boolean };
    };
  };
  response: Parameters<typeof renderResponse>[0];
};
type NormalizedIdeaQuery = ReturnType<typeof normalizeIdeaQuery>;
type CliListIdeasOptions = {
  createdBefore?: string;
  createdSince?: string;
  language?: string;
  limit: number | null;
  query?: string;
  root: string;
  states: string[];
};

function listIdeasFromCli(
  options: CliListIdeasOptions,
  sort: NormalizedIdeaQuery["sort"],
) {
  // The business annotation still names legacy sort values, but its runtime
  // delegates to the foundation normalizer that produced this canonical value.
  if (!Reflect.set(options, "sort", sort)) {
    throw new Error("Could not configure the normalized idea sort order.");
  }
  return listIdeas(options);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isCommandReport(value: unknown): value is CommandReport {
  if (typeof value !== "object" || value === null) return false;
  const observation = Reflect.get(value, "observation");
  const response = Reflect.get(value, "response");
  return typeof observation === "object" && observation !== null
    && typeof Reflect.get(observation, "state") === "string"
    && typeof response === "object" && response !== null;
}

const packageJsonUrl = new URL(
  import.meta.url.endsWith(".ts") ? "../package.json" : "../../package.json",
  import.meta.url,
);
const manifest: unknown = JSON.parse(readFileSync(packageJsonUrl, "utf8"));
const VERSION = typeof manifest === "object" && manifest !== null
  ? Reflect.get(manifest, "version") : undefined;
if (typeof VERSION !== "string") {
  throw new Error("package.json version must be a string.");
}

const TRACE_FILE_SUFFIX = ".trace.jsonl";
const AUDIENCES = ["human", "agent"];

export function normalizeTraceFileName(value: string): string {
  return value.endsWith(TRACE_FILE_SUFFIX)
    ? value
    : `${value}${TRACE_FILE_SUFFIX}`;
}

function addCommonOptions(command: Command): Command {
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

function eventLengthArgument(label: "after" | "expected") {
  return (value: string) => {
    if (!/^(0|[1-9][0-9]*)$/.test(value) || !Number.isSafeInteger(Number(value))) {
      throw new InvalidArgumentError(
        `${label} length must be a nonnegative safe integer`,
      );
    }
    return Number(value);
  };
}

export function selectOutputRenderer({
  audience = "human",
  json = false,
  stdinIsTTY = false,
  stdoutIsTTY = false,
}: {
  audience?: string;
  json?: boolean;
  stdinIsTTY?: boolean;
  stdoutIsTTY?: boolean;
}): "json" | "markdown" | "tui" {
  if (json) return "json";
  if (audience === "human" && stdinIsTTY && stdoutIsTTY) return "tui";
  return "markdown";
}

async function defaultTuiRenderer(content: string, terminal: Terminal): Promise<void> {
  const { renderTuiMarkdown } = await import("../src/foundation/tui/index.ts");
  await Reflect.apply(renderTuiMarkdown, undefined, [content, terminal]);
}

export async function render(
  report: CommandReport,
  { audience = "human", json = false }: Pick<CliOptions, "audience" | "json"> = {},
  io: Io = console,
  {
    renderTui = defaultTuiRenderer,
    terminal = { stdin: process.stdin, stdout: process.stdout },
  }: Runtime = {},
): Promise<void> {
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

function outputRenderer(options: CliOptions, runtime: Runtime): "json" | "markdown" | "tui" {
  const terminal = runtime.terminal ?? {
    stdin: process.stdin,
    stdout: process.stdout,
  };
  return selectOutputRenderer({
    ...(options.audience === undefined ? {} : { audience: options.audience }),
    ...(options.json === undefined ? {} : { json: options.json }),
    stdinIsTTY: terminal.stdin.isTTY === true,
    stdoutIsTTY: terminal.stdout.isTTY === true,
  });
}

function bootstrapDuration(runtime: Runtime): { bootstrapDurationMs?: number } {
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
}: {
  attributes: Record<string, unknown>;
  execute: () => Promise<unknown>;
  name: string;
  options: CliOptions;
}, io: Io, runtime: Runtime): Promise<CommandReport> {
  const renderer = outputRenderer(options, runtime);
  const traceAttributes = {
    ...attributes,
    outputRenderer: renderer,
    ...bootstrapDuration(runtime),
  };
  if (renderer === "tui") {
    const report: unknown = await Reflect.apply(withTraceFile, undefined, [
      options.trace, name, traceAttributes, execute,
    ]);
    if (!isCommandReport(report)) throw new Error(`${name} returned an invalid report.`);
    await render(report, options, io, runtime);
    return report;
  }
  const report: unknown = await Reflect.apply(withTraceFile, undefined, [
    options.trace, name, traceAttributes, async () => {
      const report = await execute();
      if (!isCommandReport(report)) throw new Error(`${name} returned an invalid report.`);
      await Reflect.apply(traceAsync, undefined, [
        "output.render",
        { renderer },
        () => render(report, options, io, runtime),
      ]);
      return report;
    },
  ]);
  if (!isCommandReport(report)) throw new Error(`${name} returned an invalid report.`);
  return report;
}

function contentLanguageArgument(value: string): string {
  try {
    return canonicalizeLanguageTag(value);
  } catch (caught) {
    throw new InvalidArgumentError(errorMessage(caught));
  }
}

function outputLanguageArgument(value: string): string {
  try {
    return canonicalizeOutputLanguage(value);
  } catch (caught) {
    throw new InvalidArgumentError(errorMessage(caught));
  }
}

function collectOption(value: string, previous: string[] = []): string[] {
  return [...previous, value];
}

export function createProgram(io: Io = console, runtime: Runtime = {}): Command {
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
      writeErr: (value) => writeTerminalLine(io.error, value),
      writeOut: (value) => writeTerminalLine(io.log, value),
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
  ).action(async (options: CliOptions) => {
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
      execute: () => listIdeasFromCli({
        ...(query.createdBefore === null
          ? {}
          : { createdBefore: query.createdBefore }),
        ...(query.createdSince === null
          ? {}
          : { createdSince: query.createdSince }),
        ...(options.language === undefined
          ? {}
          : { language: options.language }),
        limit: query.limit,
        ...(query.query === null ? {} : { query: query.query }),
        root: options.root,
        states: query.states,
      }, query.sort),
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
  ).action(async (idea: string | undefined, options: CliOptions) => {
    const report = await runCommand({
      name: "command.whats-next",
      options,
      attributes: {
        command: "whats-next",
        outputLanguage: options.language ?? null,
      },
      execute: () => whatsNext({
        ...(idea === undefined ? {} : { idea }),
        ...(options.language === undefined
          ? {}
          : { language: options.language }),
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
  ).action(async (options: CliOptions) => {
    const report = await runCommand({
      name: "command.create-idea",
      options,
      attributes: {
        command: "create-idea",
        contentLanguage: options.language ?? null,
      },
      execute: () => createIdea({
        ...(options.language === undefined
          ? {}
          : { language: options.language }),
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
  ).action(async (options: CliOptions) => {
    const report = await runCommand({
      name: "command.check",
      options,
      attributes: {
        command: "check",
        outputLanguage: options.language ?? null,
      },
      execute: () => checkRepository({
        ...(options.commit === undefined ? {} : { commit: options.commit }),
        ...(options.language === undefined
          ? {}
          : { language: options.language }),
        ...(options.remote === undefined ? {} : { remote: options.remote }),
        root: options.root,
        ...(options.staged === undefined ? {} : { staged: options.staged }),
        ...(options.worktree === undefined
          ? {}
          : { worktree: options.worktree }),
      }),
    }, io, runtime);
    program.setOptionValue(
      "resultCode",
      report.observation.state === "project-ready" ? 0 : 1,
    );
  });

  const runEvent = async (
    operation: "replay" | "append",
    idea: string,
    options: CliOptions,
  ) => {
    if ((operation === "append" && !options.input)
      || (operation === "replay"
        && (options.afterLength === undefined) !== (options.afterDigest === undefined))) {
      throw Object.assign(new Error("Use event replay|append <idea>; append requires --input."), { exitCode: 2 });
    }
    let input: unknown;
    if (options.input) {
      try { input = JSON.parse(readFileSync(options.input, "utf8")); }
      catch (cause: unknown) { throw Object.assign(new Error(`Cannot read business request: ${errorMessage(cause)}`), { exitCode: 2 }); }
    }
    const report = await runCommand({
      name: "command.event", options, attributes: { command: "event", operation },
      execute: () => eventCommand({ ...options, operation, idea, input }),
    }, io, runtime);
    const receipt = report.observation.receipt;
    program.setOptionValue("resultCode", report.observation.state === "event-result"
      && receipt !== undefined
      && receipt.reduction?.ok !== false
      && receipt.format?.ok !== false ? 0 : 1);
  };

  const event = program.command("event")
    .description("observe or append v2 idea events")
    .addHelpCommand(false)
    .configureHelp({ sortOptions: true, sortSubcommands: false });

  addCommonOptions(
    event.command("replay <idea>")
      .description("observe a complete event stream or an exact cursor suffix")
      .option("--language <tag>", "use a built-in output language for this invocation", outputLanguageArgument)
      .option(
        "--after-length <bytes>",
        "return only events after this observed byte cursor",
        eventLengthArgument("after"),
      )
      .option(
        "--after-digest <oid>",
        "exact observed prefix folder digest for incremental replay",
      ),
  ).action((idea: string, options: CliOptions) =>
    runEvent("replay", idea, options)
  );

  addCommonOptions(
    event.command("append <idea>")
      .description("append one validated business or interaction event")
      .option("--language <tag>", "use a built-in output language for this invocation", outputLanguageArgument)
      .option("--input <file>", "JSON business request for append")
      .option(
        "--expected-length <bytes>",
        "observed log byte length",
        eventLengthArgument("expected"),
      )
      .option("--expected-digest <oid>", "observed canonical events-folder digest")
      .option(
        "--expected-primary <commit>",
        "observed primary commit (never stored in events)",
      )
      .option(
        "--confirm-decision",
        "assert an explicit human decision for this exact request",
      )
      .option(
        "--full-history",
        "include complete historical reductions instead of the default summary",
      ),
  ).action((idea: string, options: CliOptions) =>
    runEvent("append", idea, options)
  );
  return program;
}

export async function runCli(
  args: readonly string[],
  io: Io = console,
  runtime: Runtime = {},
): Promise<number> {
  const program = createProgram(io, runtime);
  try {
    await program.parseAsync(args.length === 0 ? ["--help"] : args, { from: "user" });
  } catch (caught: unknown) {
    if (caught instanceof CommanderError) return caught.exitCode === 0 ? 0 : 2;
    if (typeof caught === "object" && caught !== null && Reflect.get(caught, "exitCode") === 2) {
      io.error(`ERROR usage: ${errorMessage(caught)}`);
      return 2;
    }
    io.error(`ERROR command.failed: ${errorMessage(caught)}`);
    return 1;
  }
  return program.getOptionValue("resultCode") ?? 0;
}

export function isMain(
  importMetaUrl: string,
  argv: readonly string[] = process.argv,
  { platform = process.platform, realpath = realpathSync.native }: {
    platform?: NodeJS.Platform;
    realpath?: (path: string) => string;
  } = {},
): boolean {
  if (!argv[1]) return false;
  const canonical = (path: string): string => {
    try {
      path = realpath(resolve(path));
    } catch {
      path = resolve(path);
    }
    return platform === "win32" ? path.toLowerCase() : path;
  };
  return canonical(fileURLToPath(importMetaUrl)) === canonical(argv[1]);
}

if (isMain(import.meta.url)) {
  const bootstrapStartedAt = process.hrtime.bigint();
  process.exitCode = await runCli(
    process.argv.slice(2),
    console,
    { bootstrapStartedAt },
  );
}
