# 本地 ping/pong 与可追加指令的 Agent 交互协议

## 意图

用 idea 本地的事件记录连接上游沟通者与下游执行者，让求助、补充指令和恢复
有明确、可重建的语义。上游可在下游运行时随时追加 `ping`，Git 阻塞也不能
锁死交互通道；本项无需 daemon 或真实 Agent 即可独立验证。

## 背景

本 idea 从
[设备级 daemon 总体设计](../../../../01M3SJ90WVJB56Z1PP72BPAHFZ/outer/inner/ideal/Idea.md)
拆出，并依赖
[事件化状态与迁移](../../../../01M3SJTKFRQ19DP0RPPJACKGMC/outer/inner/ideal/Idea.md)
提供的持久日志、追加能力和历史检查。

原始乒乓比喻用于解释上下游职责，不是严格交替的轮次锁。
2026-10-01 的最终决定明确允许上游在运行中追加指令，取代“必须先停止下游
并确认控制权交回”的旧方案。该语义必须先稳定，再由运行时和 daemon 接入。

## 期望结果

### 单个 idea 的开放式交互

每个 `ping` 绑定一个确定项目中的一个 idea，表示发起、恢复或补充执行指令，
不隐式授权推进其他 idea。一次工作的初始请求来自上游；后续 `ping` 不要求
先收到 `pong`，也不要求停止、取消或完成正在进行的工作。

新增指令仍指向该 idea 当前关联的下游执行上下文，不因此授权另一个并行
执行者。接收指令、送达执行方和完成要求是不同事实，不能互相替代。

`pong` 是结果、问题或继续所需输入的交还，不是完成或阶段性完成标记。
下游认为当前 `next step` 无法自行推进、需要人介入时可以请求交还，包括
sign-off、工作阻塞和 Git 提交失败，不必先到达预定里程碑。
执行方失效等运行故障也须能被明确表达为等待上游处理的状态。

### 多条指令不会被过期结果覆盖

交互事件关联请求、执行和响应，状态区分待处理、已送达和已处理的指令。
多个 `ping` 可以在下游完成之前存在；较早工作的结果或 `pong` 不能误清空
新到达的指令，也不能把收到消息自动解释成执行完成。

观察与恢复能够说明响应针对哪些指令、还有哪些等待处理。
重复观察不重复产生新的工作授权；重复投递和并发追加有明确的去重与冲突
语义，不靠覆盖 JSONL 中的旧事件解决。

交互事件的规范数据形状由一个独立的 `.ts` 类型定义文件导出，作为 CLI、
状态投影和后续运行时适配共同使用的编译期契约。该文件只定义本协议的事件
类型与关联字段，不复制前置 idea 提供的存储、追加或迁移实现。

每个被接受并持久化的交互事件都必须以前一完整状态投影为输入，确定性地产生
一个不同且完整的下一状态投影。该投影是在前置事件模型从旧 `status.yaml`
迁移并延续的 idea 状态之上增加交互状态，不是与生命周期并列的第二份权威。
事件类型必须明确前置条件、所迭代的状态字段和归约结果。

不能改变状态的通知、遥测、重复投递或执行日志不追加为权威事件。需要保留的
证据引用合并到实际状态转换事件；完整日志仍归下游 Agent。若一个候选事件
缺少指令标识、关联请求、目标状态或其他确定归约所需信息，必须补全或合并、
拆分该类型，不能用读取上下文、时间顺序猜测或不完整事件继续归约。

### 本地事实足以驱动交互

`ping/pong` 等交互事实通过项目版本 Silvermoon 的子命令校验并追加，不是
要求 Agent 手工编辑 JSONL，也不是只提供库接口。最新本地事件即可决定
交互状态，不必等 commit 或进入 primary。

合法的事件文件未提交追加不应独自阻断循环；其他文件仍遵循相应的原有
工作区保护规则。无效追加、对旧事件的修改和无关脏文件不能借此豁免检查。

跨设备的共享、协调与合并仍通过 Git primary 完成，不引入跨设备锁或唯一
执行权保证。本项解决上下游执行交互，不是另造一个分布式任务系统。

### Git 阻塞不会锁死求助和新指令

Git 提交失败时，下游可以 `pong`。上游随后可以 `ping` 要求“暂缓提交，
先调查 Git 问题”，而不是只能重试提交。协议能记录并路由这个新方向，
不会要求先完成那次失败的提交才能接收或处理诊断指令。

暂缓提交不是丢弃工作区、撤销历史或绕过人类 gate。必须区分正常生命周期
暂时不能前进，与交互、诊断和恢复指令仍然可用；不能用后者掩盖前者的阻塞。

### 与人类决策明确分离

生命周期事实与交互调度状态是不同投影：`ping` 不代表批准，`pong` 不代表
验收，执行方完成不代表人类接受。所有交互复用前置事件模型，不另建可变
status 或 daemon 专用的第二份项目权威状态。

交互只保存状态相关事件、必要结果和证据引用；完整执行日志归下游 Agent，
不由 Silvermoon 采集、存储或管理。

`ping` 必须新增一条可识别的待处理指令；送达与处理确认必须分别推进该指令
的状态；`pong` 必须引用它所响应或无法推进的指令集合，并推进这些指令及
idea 的交互状态。重复命令若已由去重键接受，返回既有结果而不追加一个没有
状态变化的新事件。较旧响应只能迭代其明确关联的状态，不能覆盖更新的待处理
指令。

### 不依赖真实 Agent 的验收边界

通过本地子命令和可控交互场景即可证明：连续追加多个 `ping`、较旧 `pong`
到达后仍保留新指令、未提交事件能被消费、提交失败后的诊断指令仍可进入
待执行状态，以及上述过程不生成任何隐式批准或验收。

该证明验证协议与路由状态，而不是声称已经把消息交给真实 Copilot session。
实际 session 的送达、处理边界和执行证明由运行时适配项负责。

## 范围

### 范围内

- 交互事件的请求、响应、关联、去重与调度投影语义。
- 独立 `.ts` 文件中的交互事件类型定义，供 CLI、状态投影和后续适配复用。
- 每种权威事件的前置条件、完整 payload、状态迭代和无操作拒绝规则。
- 项目本地 `ping/pong` 等交互子命令及相应校验。
- 运行中允许追加指令的规则，以及不丢失未完成指令的状态恢复。
- 合法未提交事件的卫生检查边界和 Git 阻塞下的求助、诊断通道。
- 协议文档、skill 指引和不依赖真实 Agent 的行为证明。

### 范围外

- 重新实现前置 idea 的事件存储、生命周期 reducer 或迁移工具。
- 真实 Agent 启动、session 管理、Copilot API 适配和完整执行日志。
- 设备级 daemon、跨项目资源调度和常驻进程恢复。
- 严格交替轮次、追加指令前必须停止的限制或跨设备锁服务。
- 因新指令到达就启动同一 idea 的并行执行者，或自动批准、验收。

## 约束

- 实施和验收以 `event-state-model` 的事件基础为前提；协议设计可以提前细化，
  不能为绕过依赖再造第二套存储。
- 正常交互的状态和路由规则归项目版本 Silvermoon，未来 daemon 只执行
  结构化结果，不重新解释这些规则。
- “随时追加”是接收语义，不保证外部副作用可瞬间撤销；实际送达和处理时机
  必须显式表达，不能把排队冒充已经生效。
- 保留未知工作和并发 Git 历史，禁止用破坏性清理解决诊断阻塞。
- 与其他前置项共同支撑 `0.4.0`；完成本项不单独触发 npm 发布。
- 本次仅记录契约，不实现协议、不改 schema，也不记录批准或验收。

## 实施时需细化

具体交互事件名、指令关联与顺序、送达和处理确认、重投去重、交互子命令形式，
以及正常 lifecycle 与 Git 诊断路径的边界，在实施契约中定义并证明。
每种事件必须说明如何从前一完整投影迭代到下一完整投影；无状态变化或信息
不足的候选类型必须调整或取消。这些细节不得重新引入严格乒乓轮次或提交
成功后才能通信的前置条件。

## 类型与状态转移设计

[交互协议类型与状态转移](./Interaction-protocol.ts) 是本 Ideal World 的
可执行式配套设计，随本世界 revision 一起审阅，不是仓库运行时代码或第四份
契约。下列数据形状与该文件的类型及纯状态转移函数共同定义审阅边界。

### 事件记录与 payload

沿用现有 v2 日志的 `{sequence, type, payload}` JSONL 记录：`sequence`
是从 1 起连续递增的安全整数，类型只能是已支持的生命周期事件或以下四种
新增交互事件。事件本身不增加 `eventId`、`parents`、时间戳或执行者字段；
`sequence` 同时作为交互状态最近一次变化的定位符。各 payload 只携带确定
归约所需的数据，禁止额外字段；`evidence` 是证据引用数组，不是执行日志。

| 事件类型 | 完整 payload | 前置条件与实际变化 |
| --- | --- | --- |
| `interaction.ping.appended` | `instructionId`, `idempotencyKey`, `executionContextId`, `instruction`, `acknowledges: [{responseId, expectedStateSequence}]`, `evidence` | 指令 ID 与去重键均未出现，且上下文匹配；新增一条 `queued` 指令。可同时关闭明确引用、仍待上游处理且序号匹配的 `pong`；无需等待旧 `pong`。 |
| `interaction.instructions.delivered` | `executionContextId`, `targets: [{instructionId, expectedStatus: "queued", expectedStatusSequence}]`, `evidence` | 非空、不重复的目标均仍处于指定序号的 `queued`；逐条推进为 `delivered`，记录证据。接收 `ping` 本身绝不算送达。 |
| `interaction.instructions.processing` | `executionContextId`, `targets: [{instructionId, expectedStatus: "delivered", expectedStatusSequence}]`, `evidence` | 目标均仍处于指定序号的 `delivered`；逐条推进为 `processing`。送达本身绝不算已处理。 |
| `interaction.pong.returned` | `responseId`, `executionContextId`, `targets: [{instructionId, expectedStatus: "delivered" \| "processing", expectedStatusSequence}]`, `outcome`, `summary`, `evidence` | 响应 ID 未出现且目标非空、不重复、仍在指定状态与序号；目标变为 `responded`，新增关联其 ID 集合的响应。不能响应尚未送达的指令，也不能改变未引用的新指令。 |

`instructionId` 与 `responseId` 是各自 idea 内的 ULID；`idempotencyKey`
是上游提供、在该 idea 内唯一且重试保持不变的请求键，重复请求返回已接受结果，
不得以新序号追加无操作事件。同一条指令不能复用另一键；同一键也不能换指令。
`executionContextId` 是同一 idea 的逻辑执行上下文标识，而非物理 session ID：
首个 `ping` 设定它，后续四类事件都必须匹配；物理 session 故障与重建不会
凭空切换该标识或授权并行执行。若未来需要切换逻辑上下文，须另行定义明确
状态转换，不能靠读外部 session 或复用 `ping` 偷换。

`outcome` 限于 `result`、`needs-input`、`blocked`、`git-failure`、
`runtime-failure`、`sign-off`；非 `result` 的响应等待上游处理。
`evidence` 元素具有 `kind: "repository" | "external" | "message"`、
`reference` 及可选 `commit`，它仅指向证据，不声称证据已验证。
所有标识和正文必须非空，目标序号必须是正安全整数；交互事件必须通过
扩展后的项目版本 schema 与同一条 v2 日志的规范序列化、归约及历史前缀
检查。不得并行维护一套交互 JSONL 或发明与现有记录不兼容的 envelope。

### 完整状态投影

日志回放从 `{status: {id: <目录 ULID>}, sequence: 0, interaction:
{executionContextId: null, instructions: {}, instructionIdByIdempotencyKey:
{}, pongs: {}}}` 开始。`status` 原样保留现有 v2 归约的 alias、language、
abandoned 和三个准确 revision 等字段；`sequence` 是最后归约的日志序号。
每条合法生命周期事件只迭代 `status`，每条合法交互事件只迭代 `interaction`，
两者都推进同一个 `sequence`，返回完整的下一投影。生命周期阶段仍需结合
本次观察的世界 revision 判断；交互投影不会修改或暗示批准、验收。

`instructions[instructionId]` 保存 `instructionId`、`idempotencyKey`、
原文 `instruction`、`executionContextId`、`status`（`queued`、
`delivered`、`processing`、`responded`）、`statusSequence`（最近一次
状态转移的日志序号）、可选 `responseId` 和证据引用。索引
`instructionIdByIdempotencyKey[key]` 指向已接受的指令 ID。
`pongs[responseId]` 保存 `responseId`、明确关联的 `instructionIds`、
`outcome`、`summary`、`awaitingUpstream`、`stateSequence` 和证据引用；
仅后续 `ping` 中序号匹配的 `acknowledges` 可关闭指定等待的响应。
旧 `pong` 无法覆盖其他仍为 `queued`、`delivered` 或 `processing` 的指令；
这些指令始终可从完整投影恢复。字典键按普通字符串处理，不允许特殊键
改变对象原型或绕开唯一性。

重放时先校验完整事件及连续 `sequence`，再校验引用的指令、上下文和
`expectedStatusSequence` / `expectedStateSequence`；任一目标陈旧或缺失则
拒绝整条事件，不局部归约。已经存在的 ID、去重键、无目标的转换及无法
推进交互状态的事件必须拒绝。`ping` 可以附带旧响应确认，但不要求确认所有
响应；未提交但有效的本地尾部仍可被回放与消费，Git 同步只约束跨设备共享。
CLI 的输入形状、错误映射及 JSON Schema 在获批后写入实施契约，但不能改变
这里明确的事件与投影语义。

### CLI 子命令调整

**需要调整。** 现有 `event replay <idea>` 继续读取本地日志、报告长度与摘要，
但扩展为回放并展示完整 `status`、`sequence` 和 `interaction` 投影。
现有 `event append`、`event revise` 及 `event recover` 继续服务于既有生命周期
决策和日志恢复；不能直接以当前 `event append` 实现接收运行中的 `ping`：
它在写入前要求刷新 primary、匹配 `--expected-primary` 并校验世界快照，
Git 故障时会把交互也锁死。

为交互新增本地入口 `interaction ping|deliver|process|pong <idea>
--input <payload.json> --expected-length <bytes> --expected-digest <sha256>
--audience agent`。四个操作分别生成上述四种类型的记录，输入只含相应完整
payload，不允许输入 `sequence`、`type` 或未定义字段。提交者先用
`event replay <idea> --audience agent` 取得准确日志长度、摘要、关联指令
的当前状态及其序号；写入者在事务中重新检查字节前置条件、分配下一序号、
校验项目版本 schema、完整回放以及被引用状态，原子追加到该 idea 唯一的
`events.jsonl`。同一长度与摘要上的竞争只能有一方成功；重试若已持久化
同一条请求，则返回原有结果而非制造新序号，其他冲突必须重新观察。
成功回执分别给出新长度、摘要、序号和投影，不声称交付真实 session、
已提交或已同步 primary。中断写入沿用同一受控事务与明确恢复路径。

交互入口只需本地有效的项目版本与该 idea 状态，不把网络抓取、
`--expected-primary`、commit 或 clean worktree 作为接收/送达/响应条件；
读写不得修改其他 idea、未知文件或既有生命周期事实。诊断和交互可在
Git 提交失败后继续，但不把其他脏文件标记为合法，也不绕开普通
`whats-next`、`check`、历史前缀及 primary 同步的生命周期门槛。
`whats-next` 须区分该 idea 可归约的未提交日志尾部与无效修改或无关脏文件，
允许前者供交互消费，同时明确保留正常工作流的阻塞诊断。
获批后的实施契约再指定实际选项解析、错误代码及帮助文案。
