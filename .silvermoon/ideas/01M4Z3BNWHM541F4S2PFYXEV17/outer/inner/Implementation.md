# Implementation

## Steps

### I-S01: 定义事件契约与兼容边界

在 v2 事件 schema 与 codec 中加入仅上游可授权的 `setGateMode`，payload 固定为 `level: ideal | inner | outer` 与 `mode: explicit | waived`。各层默认 `explicit`；非终态阶段可设置目标层，但首期只接受 `inner: waived`，明确拒绝 ideal、outer 的免验收。`--confirm-decision` 仅声明已有授权，不认证发送者或制造授权；既有事件历史无新增字段时保持原行为。

### I-S02: 贯通状态归约与用户指引

事件归约持久保存 inner 模式和 `waivedImplementationRevision`。前置免验收在精确 `submitInner` 时通过，迟设免验收只固化当时已提交 revision；恢复 `explicit` 不撤销已通过 revision，但新 revision 按提交时模式处理。报告以 `waived` 区分真实 `accepted`，同步更新 control、Objective checks、Markdown、canonical skill 与参考文档；ideal、outer 继续显式验收。

### I-S03: 验证兼容性与策略边界

以 codec/reducer、schema、Objective 报告和真实 repository fixture 测试覆盖默认兼容、上游授权、前置与迟设免验收、恢复显式、已通过事实、陈旧 revision、未开放层拒绝及无 `acceptInner` 的部署转换，并运行仓库 sanity、skill、commit 与 release 级校验。

## Acceptance criteria

### I-AC01: 默认行为与授权兼容

无策略的历史事件仍按全层显式验收运行；策略变更要求显式上游决策声明，合法目标层与当前非终态阶段独立，未开放层的免验收失败关闭。证明见 [ImplementationEvidence.md](./ImplementationEvidence.md) 的 schema、权限和兼容测试；这些测试不构成发送者身份认证。

### I-AC02: 有效提交免验收且事实可区分

inner `waived` 的精确提交满足检查与同步要求后进入 deploying，未写入 `acceptInner`；既有验收保留原意，outer 仍要求显式验收。证明见 [ImplementationEvidence.md](./ImplementationEvidence.md) 的归约、报告与 repository fixture 结果，断言通过依据、control 与下一步一致。

### I-AC03: 逆转与迟设边界可复现

恢复显式、在提交前后迟设策略以及对已通过阶段的影响均按 I-S02 固化；陈旧提交不能因免验收绕过精确版本校验。证明见 [ImplementationEvidence.md](./ImplementationEvidence.md) 的边界矩阵以及 canonical skill、事件参考和技术参考中的一致规则。
