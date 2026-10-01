# Implementation

## Steps

### I-S01: 实测 Copilot SDK 的运行与恢复边界

在隔离的测试工作区和明确的权限设置下，使用拟采用版本的
`@github/copilot-sdk` 与真实 Copilot CLI，验证多 session、指定工作目录、
会话复用与重启后恢复、运行中的 `immediate` 与 `enqueue`、消息及工具观察、
认证失败和连接中断。记录 `send` 接收确认与实际处理的区别、
`immediate` 转排队的边界、恢复时未完成工作的状态和是否会遗漏正式回复。
只发送不含仓库私有内容的可控指令；不保存完整对话。

初步调查：本机 `copilot --version` 为 `1.0.11`，在独立目录执行无工具的
`copilot -p` 请求成功，返回预期文本、无代码修改。隔离目录中使用
`@github/copilot-sdk@1.0.16` 的实际请求进一步验证：一个 session 收到
消息 ID 确认和 `user.message`、`assistant.message`、`session.idle`，
断开并恢复后相同 session ID 可继续返回预期文本；另一次测试在
`assistant.turn_start` 后追加 `mode: "immediate"`，两条请求均收到确认，
一次 Agent 回复采纳了后续指令。测试未开放工具权限，未接触仓库文件。
后续隔离 SDK 测试还验证了跨两个独立 Node 进程恢复同一 session ID、
单客户端中两个独立工作区会话互不混淆、运行中的第二条消息可以排队至
当前工具结束后处理，以及许可受控的自定义工具产生开始/完成事件。
这仍不证明断线期间恢复执行、工具副作用去重或断线后完整重放输出。
采用 projectUrl/ideaId 新路由的真实适配器测试还在一次性 Git 项目中验证：
本机注册、独立 worktree、真实 Copilot session、一次 `queued` 后
`unknown` 的投递观察及最终预期回复均成功；该项目与本仓库隔离，
不授予工具权限，测试后清理。它不替代完整故障验收。
故障注入测试覆盖 aborted idle、`session.error` 与 `session.shutdown`：
过程消息不能冒充正式回复；待收的回复流明确失败，后续发送只报告未知，
`start` 不会暗中替换故障 session。注入不确定的 SDK 发送失败后也清除
旧的 idle 状态且阻止盲目重试。此测试不证明真实进程断线后的输出可恢复。
受控实测命令
`SILVERMOON_REAL_COPILOT=1 node --test test/integration/copilot-runtime-live.test.js`
通过：在一次性 Git 项目中，拒绝全部工具权限，项目版本 CLI 按准确日志
前态写入两次 `ping`，同一真实 Copilot session 两轮各返回预期标识，
项目版本 CLI 追加两次 `pong` 后回放四条有序消息；无 daemon，也未保存
完整对话到本仓库。普通测试跳过在线用例。它不证明运行中 steering、
断线恢复、Git 诊断或工具副作用去重。
官方
[steering/queueing 文档](https://github.com/github/copilot-sdk/blob/main/docs/features/steering-and-queueing.md)
说明 `immediate` 可在时机错过时转排队，`send` 的消息 ID 仅证明接收；
[session persistence 文档](https://github.com/github/copilot-sdk/blob/main/docs/features/session-persistence.md)
说明恢复与缺少内建 session 锁；
[streaming events 文档](https://github.com/github/copilot-sdk/blob/main/docs/features/streaming-events.md)
区分持久事件与恢复后不会重放的临时事件。未实测的能力仍不得宣称支持。

### I-S02: 实现隔离的项目运行时协议

在同一 Silvermoon 包中增加项目版本运行时的发现、启动与结构化消息边界。
只有项目对应版本的 `whats-next` 判断正常流程；调用方负责循环、执行和将
执行结果通过该项目版本的事件子命令交回。协议协商显式拒绝不支持的版本
和能力，不让调用方重新解释项目 schema。无 daemon 的受控调用方复用
同一边界。

已新增独立进程边界：从本机注册表定位项目及 worktree，选择项目自身
已安装的 Silvermoon CLI（源仓库则用其本地入口），以 `--json` 请求
`whats-next` 或 `event replay/append`，校验基础报告形状并直接返回
四投影与退出码（`1` 为结构化的无效/不可用报告）；校验命令、idea、
事件操作与回执的基本形状，缺少安装或不支持的报告明确报错。
故障注入覆盖缺少项目自身 CLI、无效 JSON、错误操作和异常进程退出。
idea worktree 使用跟踪项目 primary 的专用分支，不以
detached HEAD 绕过项目版本对 upstream 的检查。进程测试使用两个不同的
项目入口验证分别派发；本仓库实际 CLI 在隔离 Git 项目中验证了
`ping` 写入、准确前态下的重复请求幂等、过期 `pong` 拒绝以及重新读取
的状态，且不写入本仓库事件。另一个独立 v1 schema 项目的实际 CLI
进程可返回其 `whats-next`，对不支持的事件回放则返回结构化不可用；
这验证两种项目 schema 的分派，不等于两个真实安装版本的兼容协商。
尚无设备级循环调度器。

### I-S03: 实现单实例 Agent 接口和 Copilot 适配器

在本仓库独立模块实现 [接口设计契约](./ideal/Agent-adapter.ts)，供未来每种
Agent 单实例管理多个 route。为现有 JavaScript 运行时提供实际可导入的
模块，并保留可供调用方检查的 TypeScript 类型契约。调用方按
projectUrl/ideaId 路由；本机项目注册表需显式注册 remote URL 对应
的 Git 项目，适配器负责首次创建或定位该 idea 的 worktree，并按
projectUrl/ideaId 为 Copilot session 生成稳定身份；同一路由不并发开启第二执行者，
无法确认旧 session 状态时不暗中替换。`send`、`events`、`observe` 并行
工作；`observe` 只宣称实测可提供的粒度。不能从 SDK 的接收确认推断
`processed`，不确定时报告 `unknown`；处理权限、认证和退出错误。

### I-S04: 接入本地交互事件并验证恢复

依赖 `event-state-model` 和 `local-agent-handoff` 的真实项目行为，以准确
日志长度/摘要调用项目版本事件子命令追加 `ping/pong`，只由本地事件确定
待处理消息。适配器反馈不是第二份项目权威。连续 `ping`、并发旧 `pong`、
断线与进程退出均需先重新观察，不能自动重复投递或扩大回复范围。
Agent 求助和 Git 提交阻塞后追加诊断指令均在同一 session 验证。

### I-S05: 完成受控验收和使用指引

为协议、适配器、调用方及跨版本行为增加针对性测试；对真实 Copilot
执行一次不依赖 daemon 的受控验收。更新对应文档及 skill，明确认证、
权限、观察档次、恢复不确定性与不支持能力的处理，不宣称仅用 mock
完成真实适配。

## Acceptance criteria

### I-AC01: 真实 Copilot 能力和限制有可重复证据

真实 SDK/CLI 测试分别记录 session 创建与恢复、运行中追加消息的接收及
处理边界、输出和工具活动、进程/连接故障；每项标记实测通过、不支持或
未能确认。已实测的无工具 SDK 创建、恢复和一次运行中追加只是部分证据，
不等同于故障恢复、工具可视化或完整送达保证。

### I-AC02: 项目版本独立解释流程

受控测试以两个不同 Silvermoon 版本或项目 schema 的进程运行时取得各自
结构化结果；调用方不读取项目事件来决定生命周期，未知协议能力显式报错。
用跨版本集成测试和运行时异常测试证明。

### I-AC03: 单实例适配器安全复用会话

多 route 在一个适配器实例中互不串话；同一 idea 多轮复用一个 session；
重启后恢复原关联，确实失效才显式重建。`send` 投递状态和 `observe`
档次与实测 Copilot 能力一致，过程消息不混入正式 `pong`。以隔离工作区
真实测试及错误注入测试证明。

### I-AC04: 全双工交互不会重放副作用

运行中连续 `ping` 可投递给同一执行者，一个旧 `pong` 不消去后来的
`ping`；连接丢失、结果不明和重复观察都不触发盲目重发或重复追加。
Git 阻塞后同一 session 接收“暂缓提交，先调查 Git”并执行或显式报告
阻塞。以真实交互和可控竞争/故障测试证明。

### I-AC05: 交付的包可由调用方使用

统一接口及 Copilot 适配模块可从本仓库发布包导入，类型声明与实际
JavaScript 行为一致；现有 CLI 与无状态 `whats-next` 独立可用。
运行相关测试、`pnpm check:sanity` 和 `pnpm check`，记录准确结果。
