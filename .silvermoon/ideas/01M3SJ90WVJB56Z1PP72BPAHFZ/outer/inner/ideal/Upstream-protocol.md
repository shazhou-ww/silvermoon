# 上游接入协议

服务于 [Idea.md](./Idea.md)。WSS 使用 [统一消息编码](./Message-encoding.md)，
具体类型见 [Protocol-types.ts](./Protocol-types.ts)。这是待 review 的协议候选，
不表示现有 SDK/CLI 已实现；原 request/response/event 外层与 requestId 配对
草案已被统一 message 取代。

## 连接

daemon 主动连接 upstream。远端 WSS，只有显式 loopback 测试允许 WS。HTTP
Upgrade 使用受保护配置中的 Authorization Bearer token，并固定 subprotocol
`silvermoon.v1`；认证绑定设备与 channel 身份，不信任消息自报身份。缺少/不匹配
subprotocol 或认证失败拒绝连接，不降级、不做应用层握手/capability 交集协商。

每个 JSON 消息都是 WssMessage `{ id, envelope }`。双方均可发送，sender 为
silvermoon/agent，无 participant ID、connection sequence 或独立 WireProtocolError。
无法安全识别 channel/校验 hash 的格式错误关闭连接并记录不含正文/秘密的诊断；
合法消息的业务错误以引用该输入的 content:error 表达。

## Channel 路由

| scope | 绑定对象 |
| --- | --- |
| device | device-hq repo 的 general session |
| project + projectUrl | 目标 repo 自己的 general session |
| device-idea + ideaId | HQ idea session |
| idea + projectUrl + ideaId | managed idea session |

route 在已验证 channel binding 中保存，不由 message 正文覆盖。projectUrl 是
无凭据规范 HTTPS URL，不是本机路径。未知 repo 的接入在 device channel 提交
project.onboard；接入后显式建立目标 project channel，不更换旧 channel 的 route。

Silvermoon daemon 是设备管理员，以 HQ 为工作区，通过下游执行。认证上游请求
授权 clone/onboarding，不设 allowlist 或逐 repo 额外审批；实际 URL、目录、
凭据和 OS 权限失败明确交还，不假设已有 SUDO。

## 具体内容

InputContent 是 `type: input` 与以下 operation/params 的 union：

| operation | params | 对应 operation.result |
| --- | --- | --- |
| project.onboard | projectUrl；只在 device channel | 核验成功的 projectUrl/projectKey/schema/binding |
| general.submit | message；general channel | completed/blocked/unknown ActionResult |
| idea.ping.append | expectedHead、message；idea channel | AppendReceipt |
| idea.decision.append | expectedHead、expectedPrimary、HumanDecision、humanStatement | AppendReceipt |
| idea.observe | 空 object；idea channel | IdeaSnapshot |
| idea.events.subscribe | after EventCursor；idea channel | subscriptionId 与首批 EventDelta |
| idea.events.unsubscribe | subscriptionId | 该连接订阅已解除 |

内容匹配 channel route；结果中的 route/binding 必须与依据匹配。OperationContent
通过 operation 绑定具体 result 类型，但不是一条请求必须对应一条响应：结果
使用 refs.inputs 指出实际依据，多输入/多结果均可。新输入并不要求 replyTo。

instruction 携带 Action，action.result 携带原 ActionReference 与结果。
reply.recorded 单独表达 general-session、idea-event 或 not-recorded，避免把
Agent 完成与 pong 追加成功混淆。idea.events 推送全部九种规范事件的 delta，
而非只推送 ping/pong；error 表达可区分的 stale、缺父节点、fork、cursor gap 等。

## 观察不等于完成

refs.inputs 表示纳入判断，不证明输入要求的任务全完成，也不充当 SDK durable
handoff receipt。消息保存、Agent queued/delivered/processed 与项目结果分别验证。
本机 receipts 以 channelId/messageId 关联实际副作用；重投相同 envelope 不产生
第二个 Agent turn。unknown 或缺 receipt 不证明未执行，先观察而不自动重发。

idea 输入必须校验准确事件 expectedHead；完全相同规范事件的准确前缀检查才证明
写入幂等。stale 交还，不改新 HEAD 重试；after/inputs 不替代项目前态。
明确的人类决定仍绑定 world revision 与 primary，humanStatement 不自动授权。

daemon 用无状态 Silvermoon 读取 projection/head 与准确 delta，组织持续订阅；
订阅只在当前连接有效，重连以事件 cursor 重新订阅。delta.after 等于上一批 head，
覆盖全部事件、末尾 head/sequence 一致；缺口不静默重置或退回生产 replay。

## 调度与 review

Silvermoon 的无状态规则返回 NextStep：dispatch/recipient/action 或
wait/blocked/done。daemon 路由成面向 channel 的消息，Agent 不必知道自己是
upstream/downstream。whats-next 不是传输通道，下游不另起持续 loop。

review 仍须明确传输保留/补齐、fork 协调、跨 channel action 关联、SDK 幂等
证据、wait 唤醒/背压/公平性。内容 hash 和类型检查不证明这些能力已经存在。
