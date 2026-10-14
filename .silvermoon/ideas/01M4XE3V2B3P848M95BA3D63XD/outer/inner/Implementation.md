# Implementation

## Steps

### I-S01: 建立目标上下文发现

区分 Git worktree、明确 outside-worktree 和检查失败，并保留 canonical project root。

### I-S02: 按意图路由 Objective

让 selector 缺省时选择 Device 或 Project，显式 selector 选择 Idea，并移除 Project
terminal 后的隐式 selection。

### I-S03: 更新命令契约与场景

调整 terminal/错误响应、Agent guidance 和测试，覆盖新的目标选择矩阵。

## Acceptance criteria

### I-AC01: Objective 选择准确

单元与真实 CLI 场景证明所有路径/selector 组合选择预期 Objective。

### I-AC02: Terminal 无隐式任务

断言 Device/Project terminal 没有 active idea 表或 required next step。

### I-AC03: 兼容显式导航

测试证明 `list-ideas` 和 `whats-next <idea>` 仍提供各自明确的 inventory 与 Idea 流程。
