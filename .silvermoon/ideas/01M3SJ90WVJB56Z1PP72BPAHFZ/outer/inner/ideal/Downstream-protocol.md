# 下游 Agent 接入与无状态 Silvermoon 能力

服务于 [Idea.md](./Idea.md)。上下游共用 [消息编码候选](./Message-encoding.md)
和 [类型](./Protocol-types.ts)。同一 envelope 不代表同一 channel，也不表示 SDK
已支持 envelope 透传、持久关联或幂等；这些必须提供可验证证据供 review。

## Session 与 channel

每 repo（包括 HQ）有长期、不绑定 idea 的 general session，另有独立 idea
worktree/session。常驻表示身份和上下文可保留，不要求 Agent 一直执行或连接。
HQ 只是管理员工作区，不是特殊 runtime 或 session 类型。

channel 绑定准确 repo/idea route、Silvermoon 实例与 SDK session/代次；普通
重连复用绑定，未知 session 不新建替代。general 使用 repositoryRoot，idea
额外使用 worktreeRoot，不修改 daemon 全局 cwd，不串用 HQ 上下文。

daemon 在 HQ 工作区组织工具、skill、repo 接入等管理工作，下游执行具体操作。
binary/skill release 匹配，实际权限不足明确报告。本期不做 SUDO 自检/提权。

## Agent 业务消息

AgentMessage 与 WssMessage 使用相同 `{ id, envelope }`。上游、下游 channel
各自隔离，sender 只有 silvermoon/agent。SDK adapter 将 instruction envelope
交给 Agent，再取得带真实 after/inputs 的 action.result envelope；不原样转发
上游 message，不让 Agent 理解 upstream/downstream 接线角色。

下游自主执行 instruction，可调用无状态 CLI 查询/校验/受控操作，但不查询并
领取下一轮任务。idea action 携带实际事件 HEAD/world revisions，general action
保留依据 messageIds；这些动作依据与 message 因果引用不同，不能事后附上新 HEAD。

completed 是当前 instruction 执行报告，blocked/unknown 明确表达未完成与不确定。
general 日常回复不写 idea pong；idea 正式回复由 daemon 委托 Silvermoon 受控
追加，stale 交还而不改 HEAD 重试。reply.recorded 区分实际记录结果，不自动批准
或验收，也不新增“输入已处理”的生命周期事件。

SDK callback/工具活动与 send 回执是本地观察，不伪造 Agent message。queued
不等于 consumed，session idle 不证明动作完成；不能替 Agent 填写其未观察的
inputs。无法验证正式 envelope、历史或投递关联时保持 unknown，不凭猜测重发。

## SDK adapter 本地 API

DownstreamAdapter 是 TypeScript 函数边界，不是新 WSS 或 Agent request/response：

| 方法 | 输入 | 输出 |
| --- | --- | --- |
| capabilities | 无 | resume/sendWhileRunning/inspectMessage/durableMessageCorrelation/structuredReply |
| open | SessionOpenParams：route、root、create/resume binding、skill path/digest | binding 与 running/idle/gone/unknown |
| inspect | 既有 binding | SessionState |
| send | binding、AgentMessage | queued/delivered/processed + 证据或 unknown |
| messages | binding | 正式 AgentMessage 异步流 |
| inspectMessage | binding、MessageId | found + 原消息/投递证据、not-found + 查询范围、或 unknown |
| detach | binding | 本地断开；不保证 Agent 执行停止或 session 被删除 |

create 只适用于确认尚未创建的初次持久绑定，不是 resume 失败的 fallback。
capability 为 false 时相关调用明确不可用，不伪造 receipt。not-found 只证明
查询边界，不单独授权重发。skill/root 是本地参数，不进入 WSS 或公共消息。

## 无状态 Silvermoon 能力

SilvermoonOperations 描述同一 release 的 inspect/next/observe/readSince/
appendInteraction/appendDecision 窄能力；不表示现有 CommandReport 已改版。
daemon 可直接调用业务函数，下游通过 CLI/工具使用同一规则，不增加常驻 runtime。

general next 显式输入已验证的 channel、binding 和观察消息；不根据裸 ID 猜
SDK 上下文，不建立另一套 general lifecycle。idea next/append 根据 repo facts
与准确事件前态，决定仍绑定人类事实和 primary。readSince 只读增量，daemon
维护订阅。done 表示当前无待派发动作，不自动记录人类验收。

v1 可识别/诊断/读取，但没有 v2 event capability；显式独立迁移后重观察，不
静默升级。设备安装/skill 来源检查贯彻 readiness，源码自身 runtime 保护保留。

## API 调整与 review

原 ProjectRuntime、LocalProjectRegistry、CopilotAdapter/subpaths 允许显式
非兼容调整，声明/文档/测试同步。存量 URL-hash registry 不能静默变成 projectKey
或替换 session；共享 Git 操作仍需 repo 级协调，不能只有 idea route lock。

review 须提供统一消息正常/失败时序、SDK 实测证据、channel 建立/父节点保留/
补齐、Agent envelope 输出方式、未知投递与旧新 API 对照。普通 daemon 重启的
安全重观察属于本期；从 HQ remote 整机自动恢复不属于本期。
