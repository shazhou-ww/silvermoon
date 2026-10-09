# Deployment

## Steps

### D-S01: 验证发布级候选

在完整 release-grade 检查和打包 smoke 环境中验证新增事件、历史兼容性、CLI 报告与 skill 分发副本。

### D-S02: 验证真实接续体验

从干净环境观察一个包含当前 Submit 的 idea，确认 Agent 能直接获知应等待 Accept；再改变 revision，确认报告恢复为 Agent 推进。

## Acceptance criteria

### D-AC01: 发布级检查通过

完整 `pnpm check`、skill 检查、包内容与安装 smoke 验证全部通过，并在 [Verification.md](./Verification.md) 中保存可复核结果。

### D-AC02: 接续行为可观察

干净环境中的 CLI 报告分别展示有效 Submit 对应的上游验收动作和 revision 变化后的 Agent 推进行为；在 [Verification.md](./Verification.md) 中记录真实命令与测试证明，无需依赖 ledger 推断。
