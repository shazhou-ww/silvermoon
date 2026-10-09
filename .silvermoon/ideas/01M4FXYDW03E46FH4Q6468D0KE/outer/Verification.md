# 部署验证

验证对象为实现提交 `d2c73da5e406560ab7fa2de2b99279c993a84459`。

## 发布级候选

- `pnpm check`：通过；覆盖 typecheck、build、Markdown、pure boundaries、unit、runtime、contract、integration、E2E、package pack/install smoke 与 skill 检查。
- `pnpm check:skills`：通过；canonical skill 与注册副本一致，并可被 skill discovery 发现。
- `pnpm check:commit`：实现提交及后续 lifecycle-only 提交均通过。

## 接续体验

- `test/integration/whatsnext-setup.test.ts` 中的 `projects submit readiness and phase-local control into whats-next` 在 release-grade 检查中通过，覆盖未提交、有效 Submit、ping 返回 downstream、pong 恢复 upstream，以及 revision 变化后 Submit stale 并恢复 downstream。
- primary `be461225533a0fe83280323b2b9691bc7cbe30f0` 上的实际 `whats-next agent-submit-events --audience agent` 报告 `submitInner` 为 `submitted`、控制权为 `upstream`，并提供 `acceptInner` 模板。
- primary `111c9099a13cb6424b5add2e5b90989293f90161` 上记录 `acceptInner` 后，实际报告进入 `deploying`，Inner 为 `accepted`、Outer 为 `unsubmitted`、控制权为 `downstream`。
