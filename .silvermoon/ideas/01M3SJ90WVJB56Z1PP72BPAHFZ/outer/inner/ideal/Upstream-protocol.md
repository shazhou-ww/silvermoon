# 上游接入协议

服务于 [Idea.md](./Idea.md)。以下是当前协议要求，不是已实现或已批准的 wire
schema。具体字段、操作清单、状态机和失败时序须以准确候选提交人工 review。

## 连接与信任

daemon 主动建立 WebSocket 长连接；远端使用 WSS，仅显式 loopback 测试允许 WS。
本地 upstream server 使用同一协议并执行认证，不承担项目生命周期判断。

握手需确认 daemon identity、协议版本与能力。设备选择在外层连接/控制信封，
不把 daemonId 塞入每条 route。未知版本、无效认证或格式明确拒绝，不静默降级。

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
相同 ID/相同请求是重试，相同 ID/不同请求须显式冲突。ID 作用域、保留期限和
receipt 状态机尚需定义；upstream 保留未确认请求，以同一 ID 重投。

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

idea 观察/订阅提供当前 projection/head、准确 snapshot cursor 与 cursor 后全部
增量事件，不只推送 ping/pong。snapshot 与增量须一致衔接；游标缺口、失效或未知
追加结果明确交还，不静默重置为全量 replay 或漏事件。

## 上游 handoff 与循环

上游与下游通过 daemon 通信，不直接互发协议消息。daemon 先接收并记录/观察
上游请求和下游回复，再调用 Silvermoon 的 `whats-next`/下一步能力；该调用不是
收消息通道，不以无新事实的轮询重复生成 instruction。

Silvermoon 根据当前事实生成 `recipient + instruction`；daemon 不解析 status
object 或自然语言 nextSteps 来猜路由。recipient 为 upstream 时交还上游，不能
把下游回复直接当作上游 instruction。

daemon 控制持续观察、投递、等待和再次推进；下游仅自主执行当前 instruction。
下游可以调用无状态 CLI 查询状态，但不因此成为第二个调度者。idea ping/pong
追加统一由 daemon 委托 Silvermoon 完成，避免同一回复被重复记录。

准确候选须定义动作身份、观察依据、投递去重，以及继续/等待/阻塞/无新动作的
表达和唤醒条件。重复观察不能不断派发同一动作；连接重建不能盲目重发未知动作。
背压、并发上限与跨项目公平调度在候选中明确，不新增跨设备任务状态机。

## Review 必须提供

版本/能力握手、完整 request/response/handoff 类型、route 校验、requestId 与 ack
状态机、expectedHead/cursor 操作、正常/失败/重连时序、上下游对称的动作关联。
general session 的 repo 身份、接入交接与绑定恢复须覆盖 HQ 和至少两个 managed
repos，不得通过共享 HQ 会话冒充项目隔离。
认证和 clone 授权方向已决定；上述细节尚未因本文而获批。
