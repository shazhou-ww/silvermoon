# Implementation

## Steps

### I-S01: 复核调研并冻结分层清单

以 Ideal World 的调研为起点复跑三次基线，将现有用例按依赖成本、行为覆盖、重复度和断言脆弱性分类，并冻结保留、合并、迁移或删除结论。

### I-S02: 精简用例与测试夹具

合并重复场景，移除无独立价值或过度约束呈现细节的断言，并减少重复 Git 仓库、进程和大事件流准备；关键故障与完整性路径保持真实边界验证。

### I-S03: 建立 integration 分层入口

按日常反馈与完整风险验证拆分稳定入口，并同步 package scripts、validation tiers、CI 调用和维护文档。

## Acceptance criteria

### I-AC01: 覆盖处置可追溯

现有 integration 用例均能在提交的清单或测试结构中对应到明确处置及覆盖理由；通过审阅清单与变更后的测试映射证明。

### I-AC02: 日常入口达到性能目标

同一参考环境对快速 integration 入口连续运行三次，其中位不超过 120 秒且任一次不超过 130 秒；通过保存的计时输出证明。

### I-AC03: 完整风险覆盖保持通过

完整层仍验证事件流、事务、Git 拓扑、跨进程 CLI 和发布相关路径，且相关 targeted tests、`pnpm check:sanity` 与 release-grade 检查全部通过。
