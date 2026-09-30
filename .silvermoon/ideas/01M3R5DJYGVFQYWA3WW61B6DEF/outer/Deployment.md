# 验证 CLI 性能优化进入真实仓库

## Steps

### D-S01: 发布并锁定验收候选

将实现、before / after 摘要和本 Deployment 契约发布到 configured
primary，重新观察精确 `deploymentRevision`，记录包含全部候选的 primary
commit。对该 commit 运行 `silvermoon check --remote` 和 `pnpm check`，
不执行 npm publish。

### D-S02: 在干净 clone 重放 trace benchmark

从已记录 primary commit 创建一次性干净 clone，锁定 Node、Git、pnpm、
OS、CPU、idea 数量和 active 数量。先 warm-up，再对四个子命令及全部
`check` target 各运行 5 次；确认 subprocess / metadata /
materialization 指标与相对中位数满足 contract，保留安全摘要并删除 clone。

## Acceptance criteria

### D-AC01: Primary 候选有效且可追溯

记录的 implementation 与 Deployment revisions 均可从刷新后的
`origin/main` 到达；`silvermoon check --remote` 验证同一 primary，
`pnpm check` 对候选通过，且没有 npm 发布或未授权外部副作用。

### D-AC02: 干净环境复现确定性优化

一次性 clone 的 trace 证明每个 command 的 Git process budget、
title read 数和 full-tree materialization 次数满足 Implementation
criteria；全部 5 次样本及中位数达到相对性能目标。网络 fetch 单独列示，
不计入本地优化收益。

### D-AC03: 真实命令行为保持兼容

干净 clone 中的 agent Markdown、非 TTY human、JSON 和 trace 调用返回
预期输出与退出码；worktree、index、branch 和 named refs 在只读命令后
保持不变，`create-idea` 只产生报告所列 scaffold，失败路径清理通过。
