# 统一消息编码与因果引用

服务于 [Idea.md](./Idea.md)。身份模型已确定；本文给出 Merkle DAG 与上下游共用
编码的具体 review 候选，不声称 SDK 已提供传输幂等或 envelope 回复支持。
类型在 [Protocol-types.ts](./Protocol-types.ts)，示例在
[Protocol-examples.ts](./Protocol-examples.ts)。

## 身份与格式

所有 Agent 业务交互使用 `{ id, envelope }`，不在传输外层区分 request、
response、notification，也不定义 hello/welcome 或独立 protocol-error 消息。
body 是正文与未来附件的字段扩展容器，当前形状为 `{ content: string }`。
body.content 是非空 Agent 对话文本，可以自然表达意图、指令、
结果、证据、求助或错误，不带 operation/params/result 等 RPC 分类字段。
role 由 sender/channel 决定，正文不重复 upstream/downstream 或 SDK role。

未来可在 body 增加附件字段支持图片/音频等多模态内容；本期只预留这个扩展位置，
不定义附件、URL、base64 或工具调用格式。届时须定义编码、媒体身份与 hash
覆盖边界，不将浮动外部 URL
自动当作已验证内容；不能未经版本 review 改变现有 ID 的含义。

envelope 包含 version、channelId、sender、refs、body。sender 只有
`silvermoon | agent`，没有 participant ID；Silvermoon 是实体身份，daemon 是其
运行模式。channel binding 保存双方准确身份、general/idea route 和 Agent 代次。
upstream/downstream 仅是 Silvermoon 本机接线角色，不让 Agent 依赖它判断身份。

channel 在接入配置/SDK binding 中建立并验证，不通过新增应用层握手交换。
普通重连保留 channel；替换参与者或 session 须显式处理旧在途状态并建立新绑定，
不能换 connectionId 后冒充新历史，也不能把未知 session 自动视为新会话。

## 内容寻址

候选 ID 为 `sha256:<64 位小写 hex>`：

```text
id = "sha256:" + hex(SHA-256(
  UTF8("silvermoon.message.v1\n") + UTF8(canonicalEncode(envelope))
))
```

id 本身不参与 hash。v1 的 canonicalEncode 递归按 UTF-16 code unit 升序排列
object keys，数组保持原顺序，string 使用 JSON.stringify 转义，不作 Unicode
归一化；支持 null/boolean/string、object/array 与安全整数，-0 编码为 0。
拒绝重复 key、undefined、浮点数、非有限数、非法 surrogate 与未知字段；不忽略
字段、不丢失数组元素。无额外空白/BOM/LF。与 repo Git OID 格式无关。

收到消息后先验证结构、canonical 字节和 hash，再核验 sender/channel/refs。
同 id 重投必须是同 envelope；id 不同但语义相近不能自动当作重试。重投保持
原 refs，不能附上新父节点再声称同一消息。相同 body 的再次独立发送通过新的
after 区分；本期不允许每 sender/channel 多个无关联根或自动 fork merge。

## 两种引用

- after：同 channel、同 sender 上一条发送消息，初次为 null。
- inputs：本次结果纳入的同 channel 对端消息 ID，按实际纳入顺序列出，无重复。
  不只是已收到，也不等于对应任务全部完成；求助和失败也可引用其处理依据。

after 继承此前因果历史，因此通常只列新纳入 inputs；进一步处理旧输入时可以
再引用。发送必须串行生成 after 链。缺父节点明确等待补齐/报错，不自动接到新
HEAD；分叉明确 conflict，不静默丢弃或选择一支。传输缺口恢复/父节点取回操作
与保留策略仍需 review，不由 hash 本身提供。

消息 DAG 是因果/去重依据，不是治理 lifecycle event stream。必须持久保存或可
验证取回 envelope/父节点；只存 hash 不能声称恢复。存储边界在 daemon 运行态/
上游消息保留中，不将 general transcript 或消息日志写进 HQ/project Git history。

## 上下游共用、因果不串线

上游 WSS 与下游 SDK adapter 使用同一 MessageEnvelope、canonicalEncode 与 ID
规则，但独立 channel。收到上游输入后 Silvermoon 生成下游 instruction 时，创建
新 envelope，不搬运旧 message ID；跨 channel 动作关联由本机 action/basis 记录
保留，不能将上游 ID 放入下游 channel 的 inputs。

recipient 的 upstream/downstream 留在 Silvermoon 调度结果中，不传给 Agent
要求它理解相对角色。下游回复须保留真实 inputs/after，adapter 不能根据最新
输入猜测或补写 Agent 没看到的因果引用。若 SDK/Agent 无法提供可验证 envelope
关联，明确 unknown，不盲目重发。

inputs 不替代 idea expectedHead、world revisions 或 primary。消息 hash 证明
内容身份，不证明 delivered、processed、副作用完成或 exactly-once。SDK send
回执仍是本地投递观察，不包装成 Agent 业务回复或生命周期验收。

事件 HEAD、actionId、schema capability、追加回执和投递状态属于 Silvermoon
本机控制与项目操作类型，不塞入 Agent body。Agent 正文可以描述结果与证据，
但不能因正文说“完成”就自动记录验收；准确决定与前态必须由受控流程验证。
