# Whats-next 语料采集证据

## 2026-10-14 初始场景集

- Source revision: `b771e89e2d5fe34548882c2e537ce7a5ef431f72`
- Source dirty: `false`
- Runtime: checkout 构建并通过 `pnpm setup:dev` 链接的全局 `silvermoon 0.5.0`
- Environment: `node:24-trixie-slim`，隔离 HOME、synthetic local primary 和工作副本
- Command: `scenario-lab/run.ps1`
- Result: 9 个场景、18 份 `en-US`/`zh-CN` 报告，全部 exit code 0
- Cleanup: 临时 Git bundle 已删除；完整 corpus 位于 idea-local ignored `scenario-lab/corpus/`

已采集：

- invalid user config；
- personal skill link missing；
- global runtime 从 PATH 隐藏后的 source-checkout advisory；
- untracked worktree change；
- detached HEAD；
- missing upstream；
- idea selector not found；
- implementing idea 的 accepted Ideal 基线；
- 无 selector 的 navigation。

报告核验证明 Git bundle fixture 保留了真实 world OID：基线输出为 `implementing`，
`idealRevision=797de35423c2` 保持 `accepted`。repository failure 场景分别产生
`worktree-changes`、`detached-head` 和 `primary-upstream-mismatch`，并在下一个场景前
恢复到同一主链 checkpoint。

同一 corpus 已生成 9 页 `review.html`：每页并排展示完整 `en-US`/`zh-CN` 原文，
预载 Agent 对冗余、缺失和缺少提示的初审意见。浏览器验证了分页、逐页表单的
localStorage 持久化和与 source revision 绑定的 JSON 导出文件名。
