import { readFileSync } from "node:fs";
import {
  Command,
  CommanderError,
  InvalidArgumentError,
  Option,
} from "commander";

import { canonicalizeLanguageTag } from "./language.js";
import { renderCheck, renderDialogue } from "./dialogue.js";
import { checkRepository } from "./index.js";
import { createIdea } from "./create-idea.js";
import { whatsNext } from "./whatsnext.js";

const { version: VERSION } = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);

function write(method, value) {
  const text = value.replace(/\n$/, "");
  if (text) method(text);
}

function addCommonOptions(command) {
  return command
    .option("--json", "serialize the conversation envelope as JSON")
    .option("-r, --root <path>", "repository root", process.cwd());
}

export function render(report, json, io) {
  io.log(
    json
      ? JSON.stringify(report, null, 2)
      : report.intention.command === "check"
        ? renderCheck(report)
        : renderDialogue(report),
  );
}

function languageArgument(value) {
  try {
    return canonicalizeLanguageTag(value);
  } catch (caught) {
    throw new InvalidArgumentError(caught.message);
  }
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
  $ silvermoon whats-next
  $ silvermoon whats-next <idea>
  $ silvermoon whats-next <idea> --json
  $ silvermoon create-idea
  $ silvermoon check
  $ silvermoon check --worktree
  $ silvermoon check --staged
  $ silvermoon check --commit HEAD
  $ silvermoon check --remote`);

  addCommonOptions(
    program
      .command("whats-next [idea]")
      .description("observe project, repository, and idea readiness"),
  ).action(async (idea, options) => {
    render(
      await whatsNext({ idea, root: options.root }),
      options.json,
      io,
    );
    program.setOptionValue("resultCode", 0);
  });

  addCommonOptions(
    program
      .command("create-idea")
      .description("create one structured idea scaffold after readiness checks")
      .option(
        "--language <tag>",
        "persist a canonical language override on the new idea",
        languageArgument,
      ),
  ).action(async (options) => {
    render(
      await createIdea({
        language: options.language,
        root: options.root,
      }),
      options.json,
      io,
    );
    program.setOptionValue("resultCode", 0);
  });

  addCommonOptions(
    program
      .command("check")
      .description("validate Silvermoon configuration and idea state")
      .addOption(new Option("--remote", "fetch and validate the configured primary tip").conflicts(["commit", "staged", "worktree"]))
      .addOption(new Option("--commit <revision>", "validate one local commit snapshot").conflicts(["remote", "staged", "worktree"]))
      .addOption(new Option("--staged", "validate the index snapshot").conflicts(["remote", "commit", "worktree"]))
      .addOption(new Option("--worktree", "validate HEAD plus staged, unstaged, and untracked changes").conflicts(["remote", "commit", "staged"])),
  ).action(async (options) => {
    const report = await checkRepository({
      commit: options.commit,
      remote: options.remote,
      root: options.root,
      staged: options.staged,
      worktree: options.worktree,
    });
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
