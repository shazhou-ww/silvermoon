# Ledger

## Implementation

### Implementation steps

- [x] **I-S01:** 建立五次预热基线并定位回归
- [ ] **I-S02:** 减少本地集成 fixture 的冗余 remote 初始化
- [ ] **I-S03:** 输出各并发门禁与完整检查的耗时
- [ ] **I-S04:** 固化性能回归覆盖与复现说明

### Implementation acceptance criteria

- [ ] **I-AC01:** 完整检查预热中位耗时至少降低 15%
- [ ] **I-AC02:** 所有既有验证覆盖保持完整
- [ ] **I-AC03:** Fixture 隔离、失败汇总与耗时报告可验证
- [ ] **I-AC04:** 性能测量方法可复现且不依赖机器硬预算

### Implementation notes

- 基线环境为 Windows、Node.js 24.11.1、pnpm 11.22.0、commit `c5639db`。预热后五次 `pnpm check` 为 185,357、174,495、160,047、176,941、187,818 ms，中位数 176,941 ms；`test:integration` 中位数 174,771 ms，`test:e2e` 中位数 117,963 ms。六个门禁中 integration 决定完整检查关键路径。
- Integration 共 116 个测试（114 通过、2 个因 Windows symlink 权限跳过），unit 78 个、contract 31 个、installed-package E2E 1 个；五次完整检查均通过。
- 默认 `createRepository()` 预热后五次建立真实隔离仓库为 1,507、1,495、1,464、1,495、1,621 ms，中位数 1,495 ms。细节与历史可比性限制见同世界辅助文件 `performance-baseline.md`。
- 作为历史参考，已验收 `faster-test-suite` 使用 Node.js 24.12.0、pnpm 11.22.0，完整检查中位数 54,585 ms、integration 中位数 32,337 ms，integration 为 75 个测试；工具补丁版本与覆盖均不同，不作直接验收对照。

## Deployment

### Deployment steps

- [ ] **D-S01:** 步骤标题

### Deployment acceptance criteria

- [ ] **D-AC01:** 标准标题
