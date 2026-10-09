# Implementation

## Steps

### I-S01: 扩展事件与归约模型

增加三个 downstream Submit 事件及其严格 payload、权限和重放投影，使每个提交事实绑定对应 world revision，并保留 ping/pong 的现有交互语义。

### I-S02: 按提交状态路由下一步

删除冗余的 `interaction.lastSignal`，新增由 ping/pong、Submit、Accept 及终态共同归约的控制权与最近交接投影，并将当前 revision 的 Submit 状态接入 lifecycle 与 `whats-next` 报告。

### I-S03: 固化兼容性与使用契约

覆盖事件、命令、报告和渲染测试，并同步 CLI 参考、仓库工作流和 canonical skill，明确 Submit、Accept、ledger 与 ping/pong 的职责边界。

## Acceptance criteria

### I-AC01: Submit 事件严格可验证

三个事件只接受与各自 world 对应的准确 revision，使用 downstream 权限，并通过事件 codec、reducer、append 与历史校验测试证明非法组合和陈旧写入会被拒绝。

### I-AC02: 报告明确区分推进与验收

同一 lifecycle phase 在 ping/pong 交接、未提交、当前 revision 已提交、对应 Accept 以及提交后 revision 改变时产生一致的 `owner`、最近交接与下一步报告，且不再暴露 `lastSignal`；通过 unit、contract 和 integration 测试证明 gate 仅在当前提交有效时可执行。

### I-AC03: 既有交互保持兼容

现有 ping/pong 事件与消息历史、Accept 决策、历史重放及迁移行为保持有效，消费者改用统一控制权投影，canonical skill 与文档不再把 ping/pong 或 ledger 当作阶段完成标记；通过相关回归测试和 skill 检查证明。
