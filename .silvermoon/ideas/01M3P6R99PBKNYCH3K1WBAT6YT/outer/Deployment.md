# 部署

## Steps

### D-S01: 发布仓库验证契约

通过普通、非强制的 Git 操作将本部署契约发布到配置的 primary branch。本次部署
不包含 package release 动作：不得发布 npm package、创建 npm release tag 或调用
npm 发布 workflow。

### D-S02: 验证已发布的 primary snapshot

刷新配置的 primary branch，证明已发布的部署候选可从该分支到达，并对 remote
snapshot 运行 Silvermoon 验证。针对同一候选运行仓库完整的 `pnpm check`。

### D-S03: 验证真实的默认导航输出

从干净且已同步的仓库运行 repository CLI 的默认裸 `whats-next` 命令。确认其
人类可读输出包含精确的 `navigation-ready` 状态，同时 JSON 形式继续将
`observation.state` 报告为 `navigation-ready`。

## Acceptance criteria

### D-AC01: Primary 包含已验证的候选

部署契约与已验收的实现均可从刷新后的 `origin/main` tip 到达。
`silvermoon check --remote --json` 在该 commit 上报告有效的 remote snapshot。

### D-AC02: 仓库 release-grade 检查通过

`pnpm check` 针对已发布候选成功退出，证明其 unit、integration、contract、
end-to-end、skill、Markdown 与 package 检查均通过，且不发布任何 package。

### D-AC03: Agent 整备具备可观察的就绪边界

默认裸 `whats-next` 输出包含 `navigation-ready`，对应 JSON 报告包含
`observation.state: navigation-ready`。ledger 中记录的命令结果证明两种视图一致。

### D-AC04: 部署不执行 npm 发版

部署证据只包含仓库发布与验证：不得发布 npm package、创建 npm release tag，
也不得创建或调用 npm 发布 workflow。
