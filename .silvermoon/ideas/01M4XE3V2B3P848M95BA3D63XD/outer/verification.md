# 部署验证

## 目标选择语料

- `test/unit/whats-next-model.test.ts`、
  `test/integration-extended/whatsnext-setup.test.ts` 与
  `test/integration/whatsnext-readiness.test.ts` 共 35 项通过。
- 语料覆盖 outside-worktree Device、未 adoption 与 ready Project、显式 Idea、
  selector context error、terminal 无隐式选择，以及 `en-US`/`zh-CN` 输出。

## Release-grade 验证

- 本地 `pnpm check` 已执行两次；类型、构建、Markdown、pure、contract、
  integration、pack、skill 与 installed-package CLI/API 检查通过。
- Windows Node.js `v24.12.0` 在 runtime TUI 和 installed-package TUI smoke
  启动时均以原生状态 `3221225477` 退出，使完整命令非零；该失败不经过
  Objective 路由，作为 review 风险保留，不把 release-grade 命令误报为通过。
- primary 的外部 [Push on main](https://github.com/shazhou-ww/silvermoon/actions/runs/38590235198)
  已成功完成两个 CodeQL job；该 workflow 不替代 release-grade 测试。
