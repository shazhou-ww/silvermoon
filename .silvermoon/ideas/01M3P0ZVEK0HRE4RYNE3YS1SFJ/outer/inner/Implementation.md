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

### I-S05: 支持 TUI 选区复制

保留 OpenTUI 鼠标滚动与表格交互，并为鼠标拖选的文本提供可见的 `y` 复制快捷键。
优先通过终端剪贴板协议发送选区；本地 Windows 终端不支持该协议时使用系统
PowerShell 剪贴板命令，不复制整个报告。没有选区或复制失败时在 TUI 中明确提示。
只更新 reference 文档，不在 README 中记录终端内部技术细节。

### I-S06: 指引 Agent 显式选择原始 Markdown

在 canonical Silvermoon skill 中提醒 Agent 调用报告命令时显式使用
`--audience agent` 并在重试中保留，以免双 TTY 打开人类 TUI；
需要四投影 JSON 时改用 `--json`，两者不能合用。同步仓库注册副本，
更新相应操作文档与契约测试，不在 README 中增加技术细节。

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

### I-AC06: 鼠标选区可显式复制

human TTY 的鼠标拖选后按 `y` 可把中文与 Unicode 文本发送到终端剪贴板，
本地 Windows 不支持协议时可通过系统剪贴板回退；没有选区或复制失败时
显示失败原因，不误报复制成功。测试覆盖真实 TUI 鼠标选区、UTF-8 剪贴板
输入、失败反馈及 TUI 控制提示；验证 agent、非 TTY 与 JSON 输出不变。

### I-AC07: Skill 默认指引 Agent 避开交互式 UI

canonical skill 与注册副本一致，明确要求 Agent 优先显式使用
`--audience agent`，并注明 `--json` 互斥。技能契约测试验证指引内容，
`pnpm check:skills` 和 `pnpm check` 验证同步与仓库候选。
