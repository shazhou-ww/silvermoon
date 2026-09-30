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

### I-S04: 修复 Windows TTY 的 Unicode 输出

在 Windows human TTY 中避免 OpenTUI native renderer 直接按终端旧代码页写入 UTF-8
字节，使中文与 Unicode 表格边框通过 Node 的终端输出流显示；不修改用户终端代码页，
不改变非 Windows、agent、非 TTY 或 JSON 的输出路由。加入针对 Windows 输出流
选择和 Unicode 字节转发的回归测试，并更新终端使用说明。

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

### I-AC05: Windows human TTY 正确显示 Unicode

Windows human TTY 下中文内容和 Unicode 表格边框不再以旧代码页乱码显示。
测试验证 Windows 使用 OpenTUI 的 byte feed 将 UTF-8 字节交由 Node 输出流写入，
其他平台仍使用原终端流；验证 TTY 交互渲染、agent 原始 Markdown 和 JSON
行为保持不变，并运行 `pnpm check`。
