# 关键决策点

服务于 [Idea.md](./Idea.md)。记录当前有效方向，不重述历史方案。方向已确定不
等于完整 ideal revision 已获 acceptIdeal，技术草案也不等于接口已获 review。

## 已确定

| 决策 | 当前结论 |
| --- | --- |
| 设备生产单元 | daemon 作为设备管理员，以 device-hq 为工作区，通过下游 Agent 执行管理工作 |
| 交互 actor | 人、上游 Agent、daemon、下游 Agent；repo 是数据/工作区，不放入活跃 actor 图 |
| 通信与调用 | 上下游通过 daemon 通信；daemon 与下游均可使用无状态 Silvermoon CLI 能力 |
| 消息身份 | sender 为 silvermoon/agent，双方准确身份从 channel binding 取得，不重复 participant ID |
| 消息正文 | 当前为 Agent 对话文本，不是 RPC object；多模态留待未来版本 |
| 职责分工 | 人作决定、上游取得意图与决定、daemon 调度、下游执行；无状态 CLI 返回规则/操作结果，不持有连接/session/loop |
| 循环控制 | daemon 独占持续推进；下游自主执行当前 instruction，可查询状态但不另起 loop |
| 回复与交互写入 | 下游通过正文报告结果/阻塞；daemon 以本机验证依据委托 Silvermoon 追加 ping/pong，不重复写“已处理”事件 |
| HQ 身份 | 管理员的普通 Silvermoon repo 工作区，以设备为 Outer World；不是管理员、专属 runtime 或特殊 session 类型 |
| 管理员权限 | daemon 在现有 OS 权限下管理设备；上游请求授权 repo clone/onboarding，无额外审批/allowlist |
| SUDO | 长期希望 daemon 在 device-hq 工作区组织自身管理员能力检查，本期不检查或获取 SUDO 权限 |
| binary/skill | 设备统一安装，daemon 在 device-hq 工作区组织管理、下游 Agent 执行；不要求安装在 HQ repo 或由 managed repo 各自安装 |
| schema | 推荐最新；历史 schema 可识别、诊断、迁移；完整读写范围明确，不静默升级 |
| 状态权威 | repo contracts/events 仍权威，daemon 不建立第二套生命周期状态机 |
| Session | 每 repo 一个长期、不绑定 idea 的 general session，另有独立 idea sessions；HQ 相同 |
| 日常路由 | project 选择目标 repo general session；device 选择 HQ general session，不集中承载所有项目 |
| 上游连接 | daemon 主动 WebSocket 连接；远端 WSS，本地 loopback 独立服务 |
| 上游建连 | 认证与固定 silvermoon.v1 在 HTTP Upgrade 完成；无应用层 hello/welcome 或能力清单协商 |
| API 政策 | 显式调整实验性 Agent/runtime API，不强制旧签名或旧执行行为兼容 |
| Review | 上游、下游接入协议及 Silvermoon 项目操作 API 的准确候选先由人类 review |
| HQ remote | 每逻辑设备独立 private repo，本期仅同步治理信息供未来恢复 |
| 恢复范围 | 保留正常重启/断线安全重观察；不做整机自动恢复、接管或自动生产放行 |
| 不确定性 | stale 交还、不刷新 HEAD 重试；unknown 先观察、不能盲目重发 |
| 源码结构 | 遵循 bin/business/foundation 三层；普通入口不加载 daemon/SDK |

管理员身份不替代准确 revision 上的人工批准/验收。未认证请求、损坏输入、未知
工作和不可证明的执行仍须拒绝或明确交还；“无需额外授权”不是“无需验证结果”。
repo 是数据与工作区，不是执行主体；无状态 CLI 可受控读写这些持久 facts，
“无状态”不等于无副作用，也不意味着 daemon 与下游各自维护一套项目规则。

## HQ 同步的本期边界

private remote 保存 HQ 三世界、idea events、维护实现、期望 binary/skill release、
设备治理说明和无凭据 portable projectUrl/projectKey 清单。

秘密、Agent session/transcript、receipt、cursor、lock、cache、managed checkout、
idea worktree 和本机绝对路径不进入 remote；private visibility 不替代内容核验。

daemon 在 device-hq 工作区组织候选验证、提交、刷新 primary 与普通非 force
push，由下游 Agent 执行并核验准确 commit 可达。
并发、凭据/网络失败或冲突保留本机候选、明确报告，不覆盖历史、不声称已同步。
同步触发、退避和冲突处理在实施契约细化。

未来 secret recovery、可信 bootstrap、旧 owner fencing、registry/session 重建、
unknown 对账和恢复演练另行设计。本期不交付这些流程，Git 同步不证明设备已恢复。

## 待验证与协议 review

最新 [统一 Merkle DAG 消息候选](./Message-encoding.md) 取代原 Agent
request/response/notification 外层，采用 envelope hash、after 与 inputs；
上下游共用编码、独立 channel。sender/channel 身份方向已确认；规范编码、父节点
保留/补齐、fork、SDK envelope 支持及跨 channel 关联仍是待 review 的技术候选。

共享候选类型见 [Protocol-types.ts](./Protocol-types.ts)，具体消息示例见
[Protocol-examples.ts](./Protocol-examples.ts)。类型已给出不等于语义已获 review：
SDK 持久关联、确认边界、receipt 保留与动作身份稳定性仍须验证和收敛。

| 项目 | 需要收敛的内容 |
| --- | --- |
| SDK 真实能力 | message/action 持久关联、历史查询、resume、send 崩溃窗口；无证据不承诺 exactly-once |
| 上游协议 | Upgrade/channel 绑定、Agent 文本、Merkle 引用、保留/补齐与项目事实/决定映射；无 RPC 订阅协议 |
| 下游协议 | 共用 envelope 编码、SDK 可验证因果输出、session/代次、工具 root/skill、unknown 协调 |
| Loop | 继续/等待/阻塞/无动作、唤醒、投递去重、背压与公平性 |
| 新 API | 旧新对照、结构化结果、schema capability、持久格式调整与声明/subpath |

这些是技术收敛和 review 工作，不重新打开上述产品方向。SDK 若无法满足要求，
先提供证据和具体取舍，再请求新决定；不让用户提前为假设性缺口作选择。

准确协议候选在同一 Ideal World 同步到 primary，并提供固定 commit 的上游、
下游类型/操作清单、正常/失败时序、SDK 证据与 API 变更对照供人类 review。
之后再请求完整 ideal revision 的 acceptIdeal；未获准前，Implementation、
Deployment 与 ledger 保持占位，不记为已实施或已验收。
