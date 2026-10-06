# 下游 Agent 接入与无状态 Silvermoon 能力

服务于 [Idea.md](./Idea.md)。具体下游 request/response/event 与无状态操作类型
见 [Protocol-types.ts](./Protocol-types.ts)，消息示例见
[Protocol-examples.ts](./Protocol-examples.ts)。允许显式调整原实验性 API；这些是
版本 `1` 的 review 候选，不是已发布签名，不声称 SDK 已支持持久请求幂等。

## 下游 request / response / event

这是 daemon 与 SDK adapter 的本地类型边界，不新增 WSS 服务。`DownstreamRequest`
与 `DownstreamResponse` 同样以 requestId/operation 关联，但不能发送到上游连接；
downstream event 由 SDK callback/异步 iterator 提供，不是 repo lifecycle event。

| operation | request params | ok response result |
| --- | --- | --- |
| `adapter.capabilities` | 空 object | resume/sendWhileRunning/inspectAction/durableRequestCorrelation/structuredReply |
| `session.open` | general/idea route、repositoryRoot、idea worktreeRoot、create/resume binding、skill path/digest | 已验证 binding 与 SessionState |
| `session.inspect` | 已有 binding | 相同 binding 与 running/idle/gone/unknown |
| `session.send` | binding 与对应 GeneralAction/IdeaAction | ActionReference 与 queued/delivered/processed/unknown Delivery |
| `action.inspect` | binding、ActionReference | found + delivery、not-found + 查询边界，或 unknown |
| `session.detach` | binding | disconnected: true；不表示执行已停止或 session 被删除 |

SessionBinding 包含完整 route、sessionId 与 generation。general open 不携带
idea worktree，idea open 必须提供它；create/resume 都明确目标 binding，
调用前持久化并验证 owner。create 只适用于确认未创建的初次绑定，不作为 resume
失败、SDK 列表缺失或 unknown 的自动 fallback。

skill path 是本地参数，不发送到上游；digest 校验匹配设备 binary release。
mode.binding 与 request.route 必须一致，send.action 与 binding.route 必须一致。
SDK 不支持某能力时返回 false/unsupported，不填造 receipt 或 processed 证据。

`DownstreamEvent` 的类型为 session.state、action.delivery、action.reply 与
action.activity。正式 action.reply 携带 binding、完整 ActionReference 和
ActionResult；activity 仅表达 message/tool-start/tool-end，不带完整工具正文，
也不自动成为 pong。completed 仅指当前 instruction 的执行报告，不代表阶段验收。

ActionResult 明确分为 completed（message/evidence）、blocked（message/needs）
与 unknown（message）。daemon 使用原 action basis 核验并追加 pong，不能收到
回复后才读取最新 HEAD 绑定。general 回复不进入 idea events。

capabilities 为 false 时，action.inspect 必须明确返回 unsupported 或 unknown。
not-found 的 boundary 只证明查询覆盖范围，不能单独授权重发；队列接收的
Delivery 也不能充当可恢复的持久接收回执。SDK 证据引用需要真实可查询来源，
而不是 Agent 自称的消息 ID。

## 无状态 request / response 类型

`SilvermoonRequest` / `SilvermoonResponse` 是 CLI/业务调用的目标类型描述，
不是新网络服务，也不表示既有 CommandReport 已经改版。

| operation | params | ok result |
| --- | --- | --- |
| `project.inspect` | route | route 与 SchemaCapability |
| `next` | idea route，或 general route + GeneralObservation | NextStep |
| `idea.observe` | idea route | IdeaSnapshot |
| `idea.readSince` | idea route、after | EventDelta |
| `idea.interaction.append` | idea route、expectedHead、ping/pong event input | AppendReceipt |
| `idea.decision.append` | 与上游明确决定请求同形状 | AppendReceipt |

GeneralObservation 显式包含目标 binding、所观察的请求与已关联回复，不只传入
requestIds 后让无状态函数猜 SDK 上下文。它是请求/session 的观察，不是新的
general lifecycle 状态机。NextStep 区分 dispatch、wait、blocked、done；
只有 dispatch 包含 recipient/action，其他分支不伪造 instruction。done 只表示
当前 loop 无待派发动作，不记录完成/验收事实；wait 的唤醒与调度策略仍需 review。

无状态 response 的 requestId 是调用关联，不构成去重账本。daemon 维护业务
request/action receipts；Silvermoon 仍以准确事件前态、primary 与原子写入保护
项目 facts。实际 CLI 参数与四投影报告如何映射这些目标类型须在 API review
明确，不能直接移除现有报告校验或假定 SDK/CLI 已实现此接口。

## Session 与工具上下文

每个 repo（包括 device-hq）绑定一个长期 general session，不绑定 idea；各 idea
分别绑定独立 worktree/session。general session 保留该 repo 的日常上下文，
不能借用另一个 repo 的会话，同一路由不因新输入创建并行执行者。

general session 长期存续表示 session 身份、绑定与上下文可保留/恢复，不要求
Agent 始终执行或保持连接。HQ 使用完全相同的 session 模型，没有治理专用类型。
`device` route 选择 HQ general session，`project` 选择目标 repo general session，
idea routes 选择对应 idea session。

daemon 在 device-hq 工作区组织下游可用性与 canonical skill 来源检查，由下游
Agent 执行；binary/skill 使用匹配 release。HQ 只是普通 repo 工作区，不提供专属
runtime。接入协议须明确每个 general session 的 repository root，以及 idea
session 的 worktree root、工具上下文与权限；不能依靠修改 daemon 的全局 cwd。
device-hq session 的工具范围由设备管理工作决定，不通过特殊 session 类型获得；
managed repo 会话仍绑定自身项目范围。

daemon 作为管理员，在实际 OS 权限下组织设备管理并交下游 Agent 执行，不增加
逐 repo clone 审批。本期不执行 SUDO 能力自检或自动提权；工具权限不足、
身份/目录冲突和执行失败明确返回。

## 投递与回复

下游自主执行当前 instruction，可以调用设备上的无状态 Silvermoon CLI/工具
查询、校验或完成指令要求的受控操作。daemon 可直接调用同一 CLI 背后的业务
函数，不为下游建立另一套规则。持续推进由 daemon 控制，下游不自行查询并
领取下一轮任务；`whats-next` 仅用于理解当前状态，发现变化或阻塞时报告并交还。

daemon 投递 Silvermoon 生成的 instruction，不逐条转发输入。准确候选须携带
稳定动作身份、repo/idea route 与 session 身份/代次；idea 工作附其依据的事件
HEAD/revision，general 工作保留 request/action 依据，不伪造 idea HEAD。SDK 元
数据如何绑定这些坐标须先验证。不能仅返回裸字符串并事后附上最新 HEAD。

Agent 可以在运行中接收新输入，协议要区分 steering、排队和实际处理。SDK send
成功只证明其实际承诺边界，不自动等于 delivered/processed 或副作用完成。
session 存在、idle、工具活动或缺少回复都不能证明旧动作未执行。

下游通过结构化回复报告执行结果与证据、阻塞、求助或 unknown，不直接追加同一
交互 pong。idea 的正式回复/求助由 daemon 交给 Silvermoon，经准确前态检查后
记录为 pong；若期间出现新 ping 导致 stale，交还上游，不换 HEAD 重试。
pong 不要求阶段已完成，也不表示人类验收；过程消息与工具日志不自动成为
生命周期 facts。无需新增“ping 已处理”的业务事件来表达当前 instruction 完成。

general session 的日常回复/操作结果属于该 repo 的请求上下文，不自动写成 idea
pong；需要创建/推进 idea 时先取得真实 ideaId，并通过明确的 idea 交接流程处理。

session resume、历史查询、request/action 关联和投递后崩溃的能力必须验证。
未知结果先重观察既有 session、receipt 和项目 facts；无法证明时保持 unknown，
不盲目重发、不静默新建 session。正常 daemon 重启/断线可安全重观察，但本期
不从 HQ remote 恢复 session 或整台设备。

## Silvermoon 项目操作 API

设备统一安装的 Silvermoon 对 HQ 与 managed repos 使用同一项目操作能力，
daemon 直接调用本 release 的业务函数，下游通过无状态 CLI/工具使用同一能力，
明确目标 repository/worktree root 和 schema facts；HQ 本身只是普通 repo，不是
executable 或独立 runtime。目标 API 提供：

- 当前 schema/capability、项目就绪和设备 Silvermoon/skill 来源验证；
- next/handoff：由 Silvermoon 规则生成 recipient/instruction，不复制状态机；
- projection/head 与准确 cursor 的初始观察；
- readSince：准确前缀后全部事件及新 cursor，失效时显式失败；daemon 基于该
  读取能力组织订阅与唤醒，不由无状态 CLI 持有常驻订阅；
- expected-head append：原子追加与可区分的成功、幂等、stale/conflict 结果。

不启动 managed repository 自带 Silvermoon CLI，不通过 replay CLI 做生产查询，
不绕过 event-store、reducer、history 与 state-transaction 的验证保护。
诊断 replay 可保留为独立能力，不承担 daemon 生产 loop。

这些是每次调用的规则/操作能力，不是独立常驻 runtime，也不维护 Agent session
或上下游连接。daemon 组织持续推进；下游调用能力完成当前任务；实际 session、
receipt 与项目 facts 按各自持久化边界保留。

schema v1 可识别、诊断、读取既有生命周期，但没有 v2 event capability；只能
通过保留的独立 v1→v2 迁移流程显式升级后重观察。新 binary 不静默迁移，损坏或
更新 schema 明确阻塞。源码 checkout 的自身 runtime 保护保持明确。

## API 变更与 review

`ProjectRuntime`、`LocalProjectRegistry`、`CopilotAdapter` 和 package subpaths
允许非兼容调整。不能以方法名相同或 wrapper 存在宣称旧行为兼容；新接口同步
声明、文档、版本/能力协商和测试。不为维持项目自带运行时建立双套内核。

URL-hash registry 向稳定随机 projectKey 调整时，不静默重命名已有目录或更换
session binding；候选须明确旧格式读取/迁移或拒绝方式。共享 Git 操作需要 repo
级协调，idea route lock 不代替 worktree/registry 操作的保护。

Review 提供完整 API/事件类型、session 与 action 时序、权限/root/skill 注入方式、
各 repo general/idea 绑定、SDK 验证证据、旧新接口对照和存量数据处理。未知能力显式标注，不用类型草案
证明可行性；人类 review 前不据此实施。
