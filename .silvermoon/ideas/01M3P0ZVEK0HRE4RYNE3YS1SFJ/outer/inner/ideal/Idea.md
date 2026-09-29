# 为 CLI 输出增加 Human / Agent Audience

## Intent

为 Silvermoon CLI 增加明确的输出受众选择，使默认交互体验适合人阅读、Agent 与管道消费者获得稳定的原始 Markdown，并为未来按受众演进内容保留清晰边界。

## Context

当前 CLI 将命令报告渲染成普通 Markdown。人若想在终端中获得更易读的呈现，需要额外安装并调用外部 Markdown 渲染命令；直接管道输出时，渲染内容、终端交互和下游 Agent 消费之间也没有明确区分。

Human 与 Agent 可能逐渐需要不同的信息组织方式。仅依赖 TTY 自动选择显示方式，不能表达调用方真正的受众意图；而把 ANSI 或 TUI 输出写进管道，则会降低自动化消费的可靠性。

## Desired outcome

- CLI 支持 `--audience <human|agent>`，默认受众为 `human`。
- 人类受众在 stdin 与 stdout 均连接到 TTY 时，由 Silvermoon 内置的 `tui-md` 渲染报告；不满足该条件时输出原始 Markdown。
- Agent 受众始终输出不含 TUI 控制序列的原始 Markdown，不受 TTY 状态影响。
- 显式指定 `--audience` 与 `--json` 互斥；未显式指定 audience 时，`--json` 仍提供完整的机器可读报告。
- 初始实现中 human 和 agent 的报告内容一致，仅呈现方式不同；报告建模明确区分受众与 renderer，以便未来在不改变事实来源的前提下提供受众专属内容。
- 常见终端使用不要求用户安装、配置或通过 shell 管道调用外部 Markdown 渲染工具。

## Scope

### In scope

- 为支持报告输出的 CLI 命令提供统一的 `--audience <human|agent>` 选项及默认值。
- 定义 audience、TTY 检测、`--json` 互斥和输出路由的可观察行为。
- 将 `tui-md` 渲染能力作为 Silvermoon 自身提供的功能，不要求额外安装外部 CLI。
- 为 human TTY、human 非 TTY、agent TTY/非 TTY、JSON、显式冲突参数及终端缺失等情形建立回归覆盖。
- 更新 CLI help、参考文档、README 或相关操作文档，说明 audience 语义和管道行为。

### Out of scope

- 在初始实现中为 human 与 agent 生成不同的业务事实、报告内容或状态判断。
- 改变四投影 command report、JSON shape、命令退出码、诊断顺序或生命周期语义。
- 将 Agent 输出改成纯文本、专用 JSON schema 或模型专用提示词；Agent 初始仍接收原始 Markdown。
- 要求 Agent 或 CI 拥有 TTY，或在无 TTY 时启动交互式渲染。
- 修改 shell profile、安装外部 Markdown renderer，或依赖 glow 等系统命令。
- 本次实现 CLI 以外的桌面、Web 或 IDE UI。

## Constraints

- 默认受众是 `human`；`--audience` 只能接受 `human` 和 `agent`，无效值必须作为标准 usage error 明确报告。
- TUI 只在输入和输出均为 TTY 时启用；管道、重定向、CI 与非交互终端必须收到原始 Markdown。
- `agent` 受众无论终端状态如何都不得输出 ANSI/TUI 控制序列。
- `--json` 在未显式指定 audience 时继续工作；显式同时传入 `--json` 和 `--audience` 必须明确报错，不得静默选择一种格式。
- `tui-md` 能力须随 Silvermoon 安装提供；运行时不得假设宿主机装有 glow、`tui-md` 可执行文件或其他外部 renderer。
- 初始 human 与 agent projection 必须源自同一次命令报告，不得因渲染路径不同而产生状态、事实或诊断差异。
- renderer 错误不得伪装成成功响应或静默吞掉；遵循项目既有 CLI 错误处理与退出状态约定。
