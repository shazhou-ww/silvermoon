# 上游接入协议

服务于 [Idea.md](./Idea.md)。具体 request/response/WSS message 类型在
[Protocol-types.ts](./Protocol-types.ts)，可检查的消息示例在
[Protocol-examples.ts](./Protocol-examples.ts)。以下是版本 `1` 的 review 候选，
不是已实现或已批准的 wire schema；SDK 能力与恢复保证仍须验证。

## 数据类型与消息方向

WSS 每条应用消息是一个 UTF-8 JSON object，使用顶层 `protocolVersion: 1` 和
`kind` 判别，不把命令行、token 或本机路径放入网络消息。

| 方向 | 类型 | kind 与用途 |
| --- | --- | --- |
| upstream → daemon | `UpstreamRequest` | `request`：requestId、operation、对应 params |
| daemon → upstream | `UpstreamResponse` | `response`：同 requestId/operation，ok/result 或 error/error |
| daemon → upstream | `DaemonEventMessage` | `event`：connectionId、连接内 sequence 与 typed event |
| daemon → upstream | `WireProtocolError` | `protocol-error`：无法归属合法 request 的格式/协议错误 |

`WssMessage` 是以上消息的完整 union。响应类型通过 operation 与 result 关联，
不能给 `idea.observe` 返回 general 接收回执。错误分支没有 result，成功分支没有
error；unknown 写入/投递结果不能返回持久接收成功。

连接在 HTTP Upgrade 阶段使用受保护配置中的 token 认证，采用 Authorization
Bearer header；token 不进入 JSON body。认证上下文绑定 daemon identity，而不是
信任一条应用消息自称的 daemonId。

Upgrade 请求和响应的 Sec-WebSocket-Protocol 固定为 `silvermoon.v1`，类型为
`WssSubprotocol`；服务器不接受该版本则拒绝 Upgrade，daemon 也不得接受未选择
或选择不同 subprotocol 的连接。每条 JSON 的 protocolVersion 必须与之相符。
不协商其他版本，不静默降级。

认证且版本匹配的连接建立后直接收发业务 request/response/event，不定义应用层
hello/welcome，也不交换 capabilities 清单。未知或不支持的业务 operation 返回
unsupported-capability；不能为未知 operation 生成成功 result。

## Request / response 操作清单

| operation | params | ok result |
| --- | --- | --- |
| `project.onboard` | projectUrl | HQ general session 的持久接收依据与 duplicate |
| `general.submit` | GeneralRoute、message、inReplyToActionId | 目标 general session 的持久接收依据与 duplicate |
| `idea.ping.append` | IdeaRoute、expectedHead、message、inReplyToActionId | AppendReceipt 与 duplicate |
| `idea.decision.append` | IdeaRoute、expectedHead、expectedPrimary、HumanDecision、humanStatement、inReplyToActionId | AppendReceipt 与 duplicate |
| `idea.observe` | IdeaRoute | IdeaSnapshot：head、sequence、schema、世界 revisions 与 lifecycle |
| `idea.events.subscribe` | IdeaRoute、after cursor | subscriptionId 与第一批 EventDelta |
| `idea.events.unsubscribe` | subscriptionId | 已停止该连接的 subscriptionId |
| `request.inspect` | targetRequestId | pending/accepted/failed/unknown/not-found 回执 |
| `action.ack` | actionId、boundary: received | actionId；只确认收到 upstream handoff |

`inReplyToActionId` 为 null 表示新输入，非 null 关联已有 upstream action；它不
替代 idea expectedHead，也不授权 daemon 改写 stale 输入。`action.ack` 不表达
执行完成；处理后的新输入仍经 general.submit、idea.ping.append 或明确决定操作
提交。humanStatement 是明确人类决定的上下文，不是自动批准 flag；上游须真正
取得决定，Silvermoon 仍校验准确世界 revision、primary 和事件前态。

project.onboard 的接收回执不证明 clone 已完成。完成身份/登记/schema/general
session 检查后再推送 `project.ready`；失败/unknown 通过 typed action.result
或错误响应表达，不伪造 projectKey 或成功登记。

## 推送数据

`DaemonEvent` 明确定义 request.received、project.ready、action.handoff、
action.delivery、action.result、idea.events、subscription.error 和 loop.state。
handoff 仅用于 recipient=upstream；下游动作投递使用本地 adapter 协议。

Action/ActionReference 绑定 actionId、route 与 basis；idea basis 为准确 head 与
世界 revisions，general basis 为所依据的 requestIds，不伪造 idea HEAD。
action.result 分开表示 Agent 结果与 reply recording：general-session、
idea-event 或 not-recorded。Agent 完成当前动作但 pong 追加 stale 时，两者必须
同时呈现，不能将报告丢弃或改成已成功记录。

EventDelta 的 events 包含全部九种规范 V2 事件，不只 ping/pong；sequence/type/
payload 形状与现有 event schema 相同。网络不另加字段到持久事件记录。

## 字段校验与关联规则

- requestId/actionId/subscriptionId/sessionId 是非空标识符；generation 为正安全
  整数，长度/sequence 为非负安全整数，持久事件 sequence 从 1 连续增长。
- projectUrl、ideaId、OID、语言与 payload 通过现有规范校验。EventCursor.digest
  使用目标 repo 的 Git object format；未知字段和不属于 route 分支的字段拒绝。
- 响应 requestId/operation 必须对应请求；action 与 binding 的 route/代次必须
  匹配，project.ready 的 projectUrl 必须匹配其 binding。
- requestId 去重作用域为已认证上游身份 + daemonId，跨连接保留；相同 ID 的
  operation/params 必须相同。pending/unknown 不重发 Agent turn，not-found 只
  表示缺少 receipt，不证明副作用未发生。保留/压缩期限仍待 SDK 与恢复验证。
- connectionId 由 daemon 为每次已建立连接生成，推送 sequence 从 1 开始；无需
  单独交换或确认该 ID。二者只表示当前连接传输位置，不代替事件 HEAD 或
  exactly-once。重连重新认证并验证 Upgrade subprotocol，按持久 cursor 订阅，
  不增加应用层握手或重放未知 instruction。
- EventDelta.after 必须等于调用/前一批 head，head 是本批末尾准确前缀，sequence
  是该前缀最后事件序号。分批不能拆开单事件；subscription.error 终止该订阅。
  subscriptionId 只在当前连接有效，新连接不能复用旧 ID。

类型检查不代替这些运行时校验，也不证明 SDK 提供 sdkReceiptReference。

## 连接与信任

daemon 主动建立 WebSocket 长连接；远端使用 WSS，仅显式 loopback 测试允许 WS。
本地 upstream server 使用同一协议并执行认证，不承担项目生命周期判断。

daemon identity 与固定协议版本在连接认证/HTTP Upgrade 时确认。设备选择在
外层连接上下文，不把 daemonId 塞入每条 route；无额外 hello/welcome 或能力
交集协商。未知版本、无效认证或格式明确拒绝，不静默降级。

Silvermoon daemon 是设备管理员，以 device-hq 为管理工作区，通过下游 Agent
执行具体操作。已认证上游的 repo 接入请求即授权 clone/onboarding，不再设置
allowlist、逐 repo 额外审批或二次授权 round-trip。实际 URL、目录、凭据和 OS
权限问题是可观察阻塞，不是额外授权 gate；缺少 SUDO 不隐式触发提权。

## 路由

| scope | 输入身份 | 处理者 |
| --- | --- | --- |
| `device` | 已选设备 | device-hq repo 的 general session |
| `project` | `projectUrl` | 目标 repo 自己的 general session |
| `device-idea` | `ideaId` | HQ idea 的独立 session |
| `idea` | `projectUrl`、`ideaId` | managed idea 的独立 session |

projectUrl 为无凭据规范 HTTPS repo URL，不是本机路径。route 按 discriminated
union 严格校验，不通过缺失字段、路径字符串或正文猜测 scope。不认识的 project
接入请求由 daemon 在 device-hq 工作区组织检查，通过下游 Agent clone 到
registry/storageRoot 决定的位置；不能直接派发尚未就绪的 idea。新建 idea 必须
获得真实持久 ideaId，不伪造身份。

所有 repo（包括 HQ）使用相同 general/idea session 模型。`device` 是选择 HQ
general session 的路由，不是特殊 session 类型；`project` 不能解释成借用 HQ
会话的操作上下文。接入就绪后，目标 repo 的日常请求路由到其 general session；
接入交接须核验目标身份与请求依据，不能重复执行或把上下文留在 HQ。

## 请求与事实

请求携带稳定 requestId、明确 route 与正文；general session 输入不绑定 idea，
没有 idea event HEAD，也不另建 general session lifecycle event stream。
相同 ID/相同请求是重试，相同 ID/不同请求须显式冲突。ID 作用域与 receipt
关联按上面的类型与字段规则处理；保留/压缩期限和 SDK 原子 handoff
保证仍需验证。upstream 保留未确认请求，以同一 ID 重投。

idea 输入额外携带所依据的 expectedHead `{ length, digest }`。权威追加接口原子
校验完整 folder 前态；正常路径不先查询或运行 replay CLI。准确前缀之后已有完全
相同规范事件才可确认幂等；正文相似或相同 HEAD 本身不证明重复。

stale 直接交还上游，由其重新观察和判断；daemon 不换新 HEAD 重试，不因被拒绝
输入生成工作，已合法开始的在途执行不因此自动取消。旧 pong 不扩大为新 ping
的回复。请求输入和生成的工作 instruction 不要求一一对应。

## 确认、结果与订阅

协议必须分别表达：

1. 已收件：连接已收到，不证明持久化；
2. 持久接收：idea 事件已追加，或目标 repo general session 的 SDK handoff/receipt
   已有可恢复证据；
3. Agent 投递观察：queued/delivered/processed/unknown，受 SDK 实际证据限制；
4. 项目交互事实和设备操作结果：不能用 SDK send ack 或 session idle 代替。

general session pending receipt 与 SDK send 之间的崩溃窗口必须验证。若没有证明持久接收，
不能发成功形态确认；unknown 不授权自动重复 Agent turn 或副作用。接收确认、
网络请求响应与生命周期 pong 是不同事实，pong 不逐条配对确认 ping。

daemon 通过无状态 Silvermoon 能力读取当前 projection/head、准确 snapshot cursor
与 cursor 后全部增量事件，再向上游提供 idea 观察/订阅，不只推送 ping/pong。
持续订阅与连接由 daemon 管理，不交给 CLI；snapshot 与增量须一致衔接。
游标缺口、失效或未知追加结果明确交还，不静默重置为全量 replay 或漏事件。

## 上游 handoff 与循环

上游与下游通过 daemon 通信，不直接互发协议消息。daemon 先接收并记录/观察
上游请求和下游回复，再调用 Silvermoon 的 `whats-next`/下一步能力；该调用不是
收消息通道，不以无新事实的轮询重复生成 instruction。

daemon 调用无状态 Silvermoon 能力，根据当前事实取得 `recipient + instruction`；
CLI/业务函数返回规则结果，不承担上下游收发或常驻 loop。daemon 不解析 status
object 或自然语言 nextSteps 来猜路由。recipient 为 upstream 时由 daemon
交还上游，不能把下游回复直接当作上游 instruction。

daemon 控制持续观察、投递、等待和再次推进；下游仅自主执行当前 instruction。
下游可以调用无状态 CLI 查询状态，但不因此成为第二个调度者。idea ping/pong
追加统一由 daemon 委托 Silvermoon 完成，避免同一回复被重复记录。

准确候选须定义动作身份、观察依据、投递去重，以及继续/等待/阻塞/无新动作的
表达和唤醒条件。重复观察不能不断派发同一动作；连接重建不能盲目重发未知动作。
背压、并发上限与跨项目公平调度在候选中明确，不新增跨设备任务状态机。

## Review 必须提供

连接认证与固定 subprotocol、完整 request/response/handoff 类型、route 校验、requestId 与 ack
状态机、expectedHead/cursor 操作、正常/失败/重连时序、上下游对称的动作关联。
general session 的 repo 身份、接入交接与绑定恢复须覆盖 HQ 和至少两个 managed
repos，不得通过共享 HQ 会话冒充项目隔离。
认证和 clone 授权方向已决定；上述细节尚未因本文而获批。
