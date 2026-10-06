# 关键决策点

服务于 [Idea.md](./Idea.md)。记录当前有效方向，不重述历史方案。方向已确定不
等于完整 ideal revision 已获 acceptIdeal，技术草案也不等于接口已获 review。

## 已确定

| 决策 | 当前结论 |
| --- | --- |
| 设备生产单元 | 一台设备由 HQ、daemon 与下游 Agent 治理和执行 |
| HQ 身份 | 普通 Silvermoon repo，以设备为 Outer World；不是专属 runtime 或特殊 session 类型 |
| HQ 权限 | HQ 是设备管理员；上游请求授权 repo clone/onboarding，无额外审批/allowlist |
| SUDO | 长期希望 HQ 检查自身管理员能力，本期不检查或获取 SUDO 权限 |
| binary/skill | 设备统一安装、由 HQ 项目工作管理；不要求安装在 HQ repo 或由 managed repo 各自安装 |
| schema | 推荐最新；历史 schema 可识别、诊断、迁移；完整读写范围明确，不静默升级 |
| 状态权威 | repo contracts/events 仍权威，daemon 不建立第二套生命周期状态机 |
| Session | 每 repo 一个长期、不绑定 idea 的 general session，另有独立 idea sessions；HQ 相同 |
| 日常路由 | project 选择目标 repo general session；device 选择 HQ general session，不集中承载所有项目 |
| 上游连接 | daemon 主动 WebSocket 连接；远端 WSS，本地 loopback 独立服务 |
| API 政策 | 显式调整实验性 Agent/runtime API，不强制旧签名或旧执行行为兼容 |
| Review | 上游、下游接入协议及 Silvermoon 项目操作 API 的准确候选先由人类 review |
| HQ remote | 每逻辑设备独立 private repo，本期仅同步治理信息供未来恢复 |
| 恢复范围 | 保留正常重启/断线安全重观察；不做整机自动恢复、接管或自动生产放行 |
| 不确定性 | stale 交还、不刷新 HEAD 重试；unknown 先观察、不能盲目重发 |
| 源码结构 | 遵循 bin/business/foundation 三层；普通入口不加载 daemon/SDK |

管理员身份不替代准确 revision 上的人工批准/验收。未认证请求、损坏输入、未知
工作和不可证明的执行仍须拒绝或明确交还；“无需额外授权”不是“无需验证结果”。

## HQ 同步的本期边界

private remote 保存 HQ 三世界、idea events、维护实现、期望 binary/skill release、
设备治理说明和无凭据 portable projectUrl/projectKey 清单。

秘密、Agent session/transcript、receipt、cursor、lock、cache、managed checkout、
idea worktree 和本机绝对路径不进入 remote；private visibility 不替代内容核验。

HQ 候选验证、提交、刷新 primary 并普通非 force push，确认准确 commit 可达。
并发、凭据/网络失败或冲突保留本机候选、明确报告，不覆盖历史、不声称已同步。
同步触发、退避和冲突处理在实施契约细化。

未来 secret recovery、可信 bootstrap、旧 owner fencing、registry/session 重建、
unknown 对账和恢复演练另行设计。本期不交付这些流程，Git 同步不证明设备已恢复。

## 待验证与协议 review

| 项目 | 需要收敛的内容 |
| --- | --- |
| SDK 真实能力 | request/action 持久关联、历史查询、resume、send 崩溃窗口；无证据不承诺 exactly-once |
| 上游协议 | 版本/capability、全操作类型、ack、requestId、完整事件订阅、handoff |
| 下游协议 | 每 repo general/idea 身份与代次、工具 root、skill 来源、动作身份、回复依据与 unknown 协调 |
| Loop | 继续/等待/阻塞/无动作、唤醒、投递去重、背压与公平性 |
| 新 API | 旧新对照、结构化结果、schema capability、持久格式调整与声明/subpath |

这些是技术收敛和 review 工作，不重新打开上述产品方向。SDK 若无法满足要求，
先提供证据和具体取舍，再请求新决定；不让用户提前为假设性缺口作选择。

准确协议候选在同一 Ideal World 同步到 primary，并提供固定 commit 的上游、
下游类型/操作清单、正常/失败时序、SDK 证据与 API 变更对照供人类 review。
之后再请求完整 ideal revision 的 acceptIdeal；未获准前，Implementation、
Deployment 与 ledger 保持占位，不记为已实施或已验收。
