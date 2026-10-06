# 上游接入协议

服务于 [Idea.md](./Idea.md)。上游 Agent 与 Silvermoon 使用
[统一消息编码](./Message-encoding.md)，类型见 [Protocol-types.ts](./Protocol-types.ts)，
示例见 [Protocol-examples.ts](./Protocol-examples.ts)。当前是 review 候选，不表示
SDK/CLI 已实现；原 RPC 的 operation/params/result 和订阅推送不再作为 Agent 消息。

## 连接

daemon 主动连接 upstream。远端 WSS，只有显式 loopback 测试允许 WS。HTTP
Upgrade 使用受保护配置中的 Authorization Bearer token，并固定 subprotocol
`silvermoon.v1`；认证绑定设备与 channel 身份，不信任消息自报身份。缺少/不匹配
subprotocol 或认证失败拒绝连接，不降级，不做应用层握手或 capability 清单协商。

双方发送相同 WssMessage `{ id, envelope }`，envelope 为 version/channelId/
sender/refs/content，sender 为 silvermoon/agent。没有 request/response/
notification 外层、participant ID、connection sequence 或 WireProtocolError。
无法安全验证格式、channel 或 hash 时关闭连接并记录不含正文/秘密的诊断；
合法对话中的失败/求助以普通 Agent 文本表达，不伪造成功。

## Channel 路由

| scope | 绑定对象 |
| --- | --- |
| device | device-hq repo 的 general session |
| project + projectUrl | 目标 repo 自己的 general session |
| device-idea + ideaId | HQ idea session |
| idea + projectUrl + ideaId | managed idea session |

route 在已验证 channel binding 中保存，不由正文覆盖。projectUrl 为无凭据规范
HTTPS URL，不是本机路径。未知 repo 接入意图在 device channel 表达，由 daemon
在 HQ 工作区组织检查并交下游 clone；接入后显式建立目标 project channel，
不修改旧 channel 的 route。

认证上游的 repo 接入请求即授权 clone/onboarding，不设 allowlist 或逐 repo
额外审批。实际 URL、目录、凭据和 OS 权限失败明确交还，不假设已有 SUDO。
自然语言意图的执行仍须经过明确目标、身份与真实结果核验，不能据正文自动
覆盖未知工作或扩大一个 idea 的执行范围。

## Agent 消息内容

当前 content 是非空文本 string，不是命令 object。例如：

```json
{
  "version": 1,
  "channelId": "device-general-channel",
  "sender": "agent",
  "refs": { "after": null, "inputs": [] },
  "content": "请接入 https://github.com/example/project.git，并检查项目状态。"
}
```

该 envelope 在实际发送前规范编码并计算外层 id。结果、工作指令、错误和求助
同样是文本，使用 after/inputs 表示因果依据；不要求一条输入对应一条回复，
也不新增 structured operation.result/action.result 的网络分类。

未来多模态是内容格式扩展方向，不是本期能力；本期拒绝数组附件或未定义 object。

## 因果依据与项目事实

refs.inputs 表示实际纳入判断的对端消息，不证明任务全完成，不充当 SDK 持久
接收证明。双方 after 链与 hash 保护消息身份，Silvermoon 本机 receipts 关联
channelId/messageId 与实际副作用。unknown 或缺 receipt 不证明未执行，
先观察而不盲目重发。

上游消息不是 event append RPC，不能将正文中说“批准”自动当作人类决定。
Silvermoon 的本机受控流程记录适当 idea ping，并保存准确事件前态、消息与动作
关联；明确决定仍须证明人类授权、准确 world revision、primary 和 expectedHead。
这些写入参数不放进通用 Agent content，具体授权证据与消息映射须协议 review。

项目 cursor、snapshot、delta 与追加回执是无状态 Silvermoon 的本机数据，
不是对上游 Agent 的专用事件订阅协议。daemon 用这些事实决定何时生成对话消息，
不以文本解析代替 lifecycle 规则。消息 refs 不替代项目 HEAD，也不授权刷新
HEAD 后重试旧回复；未知/陈旧事实须明确交还。

## 调度与 review

无状态规则返回 NextStep，daemon 将工作或交还内容组织成 Agent 消息。
upstream/downstream 只在本机调度层存在；Agent 不需要知道相对接线角色。
whats-next 不是消息传输通道，下游不另起持续 loop。

review 仍需明确 channel 建立、父节点保留/补齐、fork 处理、跨 channel 动作
关联、文本与显式决定/事件写入的映射，以及 SDK 可验证投递能力。hash 与类型
检查不证明投递 exactly-once，也不授权从自然语言猜人类决定。
