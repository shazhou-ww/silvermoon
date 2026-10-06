# 下游 Agent 与 runtime 接入协议

服务于 [Idea.md](./Idea.md)。允许显式调整原实验性 API；以下是目标能力与保护
边界，不是最终方法签名，也不声称 SDK 已支持持久请求幂等。

## Session 与工具上下文

每个 repo（包括 device-hq）绑定一个长期 general session，不绑定 idea；各 idea
分别绑定独立 worktree/session。general session 保留该 repo 的日常上下文，
不能借用另一个 repo 的会话，同一路由不因新输入创建并行执行者。

general session 长期存续表示 session 身份、绑定与上下文可保留/恢复，不要求
Agent 始终执行或保持连接。HQ 使用完全相同的 session 模型，没有治理专用类型。
`device` route 选择 HQ general session，`project` 选择目标 repo general session，
idea routes 选择对应 idea session。

HQ 负责下游可用性与 canonical skill 正确来源；binary/skill 使用匹配 release。
这是普通 HQ repo 的项目工作，不表示 HQ 提供专属 runtime。接入协议须明确每个
general session 的 repository root，以及 idea session 的 worktree root、工具
上下文与权限；不能依靠修改 daemon 的全局 cwd。HQ 的工具范围由设备管理工作
决定，不通过特殊 session 类型获得；managed repo 会话仍绑定自身项目范围。

HQ 在实际 OS 权限下管理设备，不增加逐 repo clone 审批。本期不执行 SUDO
能力自检或自动提权；工具权限不足、身份/目录冲突和执行失败明确返回。

## 投递与回复

daemon 投递 Silvermoon 生成的 instruction，不逐条转发输入。准确候选须携带
稳定动作身份、repo/idea route 与 session 身份/代次；idea 工作附其依据的事件
HEAD/revision，general 工作保留 request/action 依据，不伪造 idea HEAD。SDK 元
数据如何绑定这些坐标须先验证。不能仅返回裸字符串并事后附上最新 HEAD。

Agent 可以在运行中接收新输入，协议要区分 steering、排队和实际处理。SDK send
成功只证明其实际承诺边界，不自动等于 delivered/processed 或副作用完成。
session 存在、idle、工具活动或缺少回复都不能证明旧动作未执行。

idea 的正式回复/求助保持执行依据，经 Silvermoon 准确前态检查后才成为 idea pong；若
期间出现新 ping 导致 stale，交还上游，不换 HEAD 重试。pong 不要求阶段已完成，
也不表示人类验收；过程消息与工具日志不自动成为生命周期 facts。

general session 的日常回复/操作结果属于该 repo 的请求上下文，不自动写成 idea
pong；需要创建/推进 idea 时先取得真实 ideaId，并通过明确的 idea 交接流程处理。

session resume、历史查询、request/action 关联和投递后崩溃的能力必须验证。
未知结果先重观察既有 session、receipt 和项目 facts；无法证明时保持 unknown，
不盲目重发、不静默新建 session。正常 daemon 重启/断线可安全重观察，但本期
不从 HQ remote 恢复 session 或整台设备。

## Silvermoon 项目操作 API

设备统一安装的 Silvermoon 对 HQ 与 managed repos 使用同一项目操作能力，
直接调用本 release 的业务函数并显式传入 repository/worktree root 和 schema
facts；HQ 本身只是普通 repo，不是 executable 或独立 runtime。目标 API 提供：

- 当前 schema/capability、项目就绪和设备 Silvermoon/skill 来源验证；
- next/handoff：由 Silvermoon 规则生成 recipient/instruction，不复制状态机；
- projection/head 与准确 cursor 的初始观察；
- readSince/subscribe：准确前缀后全部事件及新 cursor，失效时显式失败；
- expected-head append：原子追加与可区分的成功、幂等、stale/conflict 结果。

不启动 managed repository 自带 Silvermoon CLI，不通过 replay CLI 做生产查询，
不绕过 event-store、reducer、history 与 state-transaction 的验证保护。
诊断 replay 可保留为独立能力，不承担 daemon 生产 loop。

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
