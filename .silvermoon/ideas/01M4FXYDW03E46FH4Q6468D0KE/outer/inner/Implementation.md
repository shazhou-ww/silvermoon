# Implementation

## Steps

### I-S01: 扩展事件与归约模型

增加三个 downstream Submit 事件及其严格 payload、权限和重放投影，使每个提交事实绑定对应 world revision，并保留 ping/pong 的现有交互语义。

### I-S02: 按提交状态路由下一步

将当前 revision 的 Submit 状态接入 lifecycle 与 `whats-next` 报告：未提交时由 Agent 继续，已提交时等待对应 Accept 并提供权威 gate 呈现；revision 改变后回到未提交状态。

### I-S03: 固化兼容性与使用契约

覆盖事件、命令、报告和渲染测试，并同步 CLI 参考、仓库工作流和 canonical skill，明确 Submit、Accept、ledger 与 ping/pong 的职责边界。

## Acceptance criteria

### I-AC01: Submit 事件严格可验证

三个事件只接受与各自 world 对应的准确 revision，使用 downstream 权限，并通过事件 codec、reducer、append 与历史校验测试证明非法组合和陈旧写入会被拒绝。

### I-AC02: 报告明确区分推进与验收

同一 lifecycle phase 在未提交、当前 revision 已提交以及提交后 revision 改变三种情况下产生不同且一致的结构化报告；通过 unit、contract 和 integration 测试证明 gate 仅在当前提交有效时可执行。

### I-AC03: 既有交互保持兼容

现有 ping/pong 消息、Accept 决策、历史重放及迁移行为保持有效，canonical skill 与文档不再把 ping/pong 或 ledger 当作阶段完成标记；通过相关回归测试和 skill 检查证明。
