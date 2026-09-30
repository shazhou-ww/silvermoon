# Implementation

## Steps

### I-S01: 建立五次预热基线并定位回归

在固定的 Windows checkout 上使用 Node.js 24.11.1 与 pnpm 11.22.0，先运行一次
`pnpm check` 预热，再连续运行五次并保留每次墙钟耗时、可观测的分层测试耗时和
测试数量。将原始样本写入同世界辅助文件 `performance-baseline.md`。复核历史
`faster-test-suite` 数据时，明确标注 Node.js 补丁版本及测试覆盖数量不同，不把
两者当作完全相同条件下的直接对照。

### I-S02: 减少本地集成 fixture 的冗余 remote 初始化

仅优化 `test/helpers/repository.js` 提供的真实 Git 测试 fixture：审查集成测试中
哪些场景只需要本地仓库，并让这些场景不再创建未使用的 bare primary、remote
配置和 push。需要 fetch、primary ancestry 或真实远端行为的场景仍显式使用隔离的
bare remote。保留默认 fixture 行为、真实文件系统和 Git 验证、每个测试独立仓库及
既有断言；不得改变 Silvermoon 运行时代码或移除测试覆盖。

### I-S03: 输出各并发门禁与完整检查的耗时

在 `scripts/run-checks.mjs` 中为每个门禁和完整 `pnpm check` 记录单调时钟耗时，
使成功与失败的门禁都能被观察。保留六个既有门禁、并发执行、等待所有结果和完整
失败汇总；耗时报告不得引入外部 I/O、绝对超时或成功形状的失败结果。

### I-S04: 固化性能回归覆盖与复现说明

为本地/远端 fixture 选择及门禁耗时报告添加确定性回归测试，并更新
`docs/maintaining.md` 中的快速反馈、完整检查和重复测量说明。说明应要求同一
checkout、相同工具版本、一次预热与五次样本，不把网络、排队或偶然缓存收益算作
优化。

## Acceptance criteria

### I-AC01: 完整检查预热中位耗时至少降低 15%

在 I-S01 的同一机器、Node.js/pnpm 版本、checkout 和命令下，对优化后的五次预热
`pnpm check` 运行取中位数。相较 `performance-baseline.md` 中 176,941 ms 的基线
中位数，至少降低 15%；原始五次样本必须记录在 ledger。不得通过跳过门禁、删减
断言或把必需发布检查移出 `pnpm check` 达成目标。

### I-AC02: 所有既有验证覆盖保持完整

`pnpm check` 仍执行 lint:markdown、check:quick、test:integration、pack:check、
test:e2e 和 check:skills 六个门禁。`pnpm test`、`pnpm test:integration`、
`pnpm test:e2e` 与 `pnpm check` 全部以退出码 0 完成；优化前后的 unit、contract、
integration 和 installed-package 覆盖数量不得减少，Windows 上原有条件跳过仍须有
明确原因。

### I-AC03: Fixture 隔离、失败汇总与耗时报告可验证

回归测试证明本地 fixture 不创建 remote、需要远端行为的 fixture 仍能完成真实
Git fetch/push 路径；运行后无共享可变状态、遗留临时仓库或 Git 配置/引用泄漏。
调度器测试证明每个门禁及完整检查都输出单调耗时，且失败时仍等待所有门禁并汇总
全部错误。

### I-AC04: 性能测量方法可复现且不依赖机器硬预算

贡献者文档给出可直接运行的快速反馈与完整门禁命令、五次预热测量方法和结果解释。
性能阈值只用于同一基线环境的前后比较，不形成依赖机器绝对速度的普通 CI 硬预算；
文档链接与 `git diff --check` 通过。
