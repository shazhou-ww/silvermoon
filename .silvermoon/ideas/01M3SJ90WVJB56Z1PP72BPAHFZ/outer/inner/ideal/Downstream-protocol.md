# 下游 Agent 与 runtime 接入协议

服务于 [Idea.md](./Idea.md)。允许显式调整原实验性 API；以下是目标能力与保护
边界，不是最终方法签名，也不声称 SDK 已支持持久请求幂等。

## Session 与工具上下文

设备只绑定一个长期 HQ governance session；project route 是它的操作上下文，
不另建 managed project governance session。设备与 managed idea 分别绑定独立
worktree/session，同一路由不因新输入创建并行执行者。

HQ 负责下游可用性与 canonical skill 正确来源；binary/skill 使用匹配 release。
接入协议须明确 governance 操作 repo 时的 root、工具上下文与权限如何选择，
不能依靠修改 daemon 的全局 cwd。idea 工具范围与设备治理角色保持可识别。

HQ 在实际 OS 权限下管理设备，不增加逐 repo clone 审批。本期不执行 SUDO
能力自检或自动提权；工具权限不足、身份/目录冲突和执行失败明确返回。

## 投递与回复

daemon 投递 Silvermoon 生成的 instruction，不逐条转发输入。准确候选须携带
稳定动作身份、route、session 身份/代次与依据的事件 HEAD/revision；SDK 元数据
如何绑定这些坐标须先验证。不能仅返回裸字符串并事后附上最新 HEAD。

Agent 可以在运行中接收新输入，协议要区分 steering、排队和实际处理。SDK send
成功只证明其实际承诺边界，不自动等于 delivered/processed 或副作用完成。
session 存在、idle、工具活动或缺少回复都不能证明旧动作未执行。

正式回复/求助保持执行依据，经 runtime 准确前态检查后才成为 idea pong；若
期间出现新 ping 导致 stale，交还上游，不换 HEAD 重试。pong 不要求阶段已完成，
也不表示人类验收；过程消息与工具日志不自动成为生命周期 facts。

session resume、历史查询、request/action 关联和投递后崩溃的能力必须验证。
未知结果先重观察既有 session、receipt 和项目 facts；无法证明时保持 unknown，
不盲目重发、不静默新建 session。正常 daemon 重启/断线可安全重观察，但本期
不从 HQ remote 恢复 session 或整台设备。

## HQ runtime API

runtime 使用 HQ release 直接调用本机业务能力，显式传入 repository/worktree
root 和 schema facts。目标 API 提供：

- 当前 schema/capability、项目就绪和 HQ runtime/skill 来源验证；
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
SDK 验证证据、旧新接口对照和存量数据处理。未知能力显式标注，不用类型草案
证明可行性；人类 review 前不据此实施。
