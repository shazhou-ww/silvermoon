# Deployment

## Steps

### D-S01: 发布稳定的验真契约

将本 Deployment 契约单独发布至配置的 primary，重新运行指定 idea 的
`whats-next --json`，记录发布后的精确 deployment revision。后续外部验证
以这一 revision 为目标，不在验证时修改内层 world 或实现交付物。

### D-S02: 验证 primary 与安装包消费者

对已发布的 primary 执行 `silvermoon check --remote`，确认远端快照
及本 idea 的 lifecycle 有效。在发布后的仓库运行现有安装包 e2e，
验证从当前源码打包并安装到独立消费者后的 `check`、`create-idea`
和整备输出；核对其结果与已批准的 observation 契约一致。

## Acceptance criteria

### D-AC01: primary 可验证

`silvermoon check --remote --json` 对已发布的 primary 返回
`project-ready`，且 `problems` 为空；指定 idea 的 `whats-next --json`
返回 `idea-selected`、`selectedIdea.state: deploying` 和与已发布
Deployment 契约一致的 revision。记录 primary commit 和 revision。

### D-AC02: 已安装消费者遵守输出契约

`pnpm test:e2e` 的 installed-package smoke 通过；打包后的 CLI
在独立消费者中呈现 `check` 的两字段报告、成功创建后的
`idea-created/createdIdea`、dirty worktree 下的
`repository-sync-required`，且真实 fetch/scaffold 结果保留于
`outcomes`。记录测试结果，不将源码单元测试当作安装包验真。
