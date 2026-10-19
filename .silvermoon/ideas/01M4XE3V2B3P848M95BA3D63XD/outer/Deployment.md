# Deployment

## Steps

### D-S01: 重跑目标选择语料

在隔离设备与不同 repository 上重跑各 Objective 起点、terminal 与 selector
的双语语料，并把结果记录到 `verification.md`。

### D-S02: 发布命令语义说明

同步入门与 CLI/reference 文档，说明路径上下文、selector 与显式 inventory
命令的职责。

## Acceptance criteria

### D-AC01: 外部命令行为一致

release-grade 检查、primary CI 与语料证明公开 CLI 按新矩阵稳定选择 Objective；
证据入口为 `verification.md`。

### D-AC02: 迁移说明可执行

`docs/getting-started.md` 与 `docs/reference.md` 明确原 bare navigation 用户改用
`list-ideas`，示例命令可直接运行。
