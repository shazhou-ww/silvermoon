# Implementation

## Steps

### I-S01: Model audience and output routing

Add one common `--audience <human|agent>` option to every report-producing
command. Keep `human` as the implicit default, reject unsupported values and an
explicit `--audience` combined with `--json` as usage errors, and select JSON,
raw Markdown, or TUI rendering without changing the command report or its
business intention.

### I-S02: Provide the bundled human TUI renderer

Package `tui-md` and compatible OpenTUI React runtime dependencies with
Silvermoon. Dynamically load that renderer only for the default or explicit
human audience when stdin and stdout are both TTYs. Present the response
Markdown in a scrollable terminal view with an explicit quit path, while
letting renderer initialization or runtime setup failures follow the existing
command-failure path instead of silently falling back.

### I-S03: Cover and document every output mode

Add focused tests for option registration, validation, renderer selection,
agent and non-TTY raw Markdown, human dual-TTY dispatch, JSON compatibility,
and installed-package behavior. Update help, README, getting-started,
operations, and reference documentation with the audience semantics, TTY
requirements, TUI controls, and pipeline guidance.

## Acceptance criteria

### I-AC01: Audience options have one consistent CLI contract

Every public report-producing command exposes `--audience <human|agent>`;
omission resolves to human, invalid values and explicit `--json --audience`
combinations exit as usage errors, and `--json` without an explicit audience
still serializes all four projections. Unit tests of the Commander surface and
`runCli` prove these outcomes.

### I-AC02: Rendering follows the complete audience and TTY matrix

Human output uses `tui-md` only when both stdin and stdout are TTYs; human
non-TTY and every agent invocation emit the unchanged response Markdown
without ANSI/TUI control sequences. Focused renderer-selection tests inject
TTY states and a TUI renderer spy, and compare raw outputs generated from the
same command report.

### I-AC03: The renderer ships with Silvermoon and fails explicitly

The package manifest and packed-package smoke test prove that `tui-md` and its
compatible OpenTUI/React runtime are installed with Silvermoon and no external
renderer executable is required. A focused failure test proves that TUI
initialization errors produce the repository-standard command failure and
nonzero exit rather than a raw-Markdown success fallback.

### I-AC04: Documentation and repository validation pass

CLI help and user documentation describe the default audience, raw pipeline
mode, JSON conflict, dual-TTY requirement, and TUI quit controls. `pnpm check`
proves the complete repository candidate, including Markdown, unit,
integration, end-to-end, skill, and package checks.
