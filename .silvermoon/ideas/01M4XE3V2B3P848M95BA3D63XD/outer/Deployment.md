# Deployment

## Steps

### D-S01: 重跑目标选择语料

在隔离设备与不同 repository 上采集各 Objective 起点和 terminal 的双语输出。

### D-S02: 发布命令语义说明

同步 CLI/reference 文档，说明路径上下文、selector 与显式 inventory 命令的职责。

## Acceptance criteria

### D-AC01: 外部命令行为一致

release-grade 检查与语料证明公开 CLI 按新矩阵稳定选择 Objective。

### D-AC02: 迁移说明可执行

文档明确原 bare navigation 用户改用 `list-ideas`，示例命令可直接运行。
