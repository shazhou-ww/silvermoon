# 部署方案

## 部署步骤

### D-S01: 验证已发布的仓库候选

发布本部署合同后，刷新 `origin/main`，并从 primary 分支验证已验收的实现。
运行完整仓库检查，验证远端 Silvermoon snapshot，并实际运行默认的人类可读
`whats-next` 输出，确认 Active ideas 以 ID/Alias/State Markdown 表格呈现。

本次部署止于仓库验证，不得发布 npm package、创建 release tag 或调用 npm
发布工作流。

## 部署验收标准

### D-AC01: 已发布的 primary 通过仓库验证

实现与本部署合同均可从刷新后的 `origin/main` 到达；`pnpm check` 成功退出；
`silvermoon check --remote --json` 报告远端 snapshot 有效；默认的人类可读
`whats-next` 输出包含 Active ideas 的 ID/Alias/State 表格。记录的部署证据需
确认未执行任何 npm 发布。
