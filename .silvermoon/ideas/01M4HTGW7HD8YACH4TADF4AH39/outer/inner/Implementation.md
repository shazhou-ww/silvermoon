# Implementation

## Steps

### I-S01: 复核调研并冻结分层清单

以 Ideal World 的调研为起点复跑三次基线，将现有用例按依赖成本、行为覆盖、重复度和断言脆弱性分类。默认 `test:integration` 作为 fast 层，extended 层承载压力规模与完整组合，platform smoke 只覆盖原生文件身份和小规模真实 CLI。

### I-S02: 精简用例与测试夹具

合并重复场景，移除无独立价值或过度约束呈现细节的断言，并减少重复 Git 仓库、进程和大事件流准备；关键故障与完整性路径保持真实边界验证。

### I-S03: 建立 integration 分层入口

按日常反馈与完整风险验证拆分稳定入口：本地默认和 pull request 执行 fast，OS/Node matrix 执行 platform smoke，定时、release 与 publish 执行 fast 加 extended；同步 package scripts、validation tiers、CI 调用和维护文档。

## Acceptance criteria

### I-AC01: 覆盖处置可追溯

现有 integration 用例均能在提交的清单或测试结构中对应到明确处置及覆盖理由；通过审阅清单与变更后的测试映射证明。

### I-AC02: 日常入口达到性能目标

同一参考环境对快速 integration 入口连续运行三次，其中位不超过 120 秒且任一次不超过 130 秒；通过保存的计时输出证明。

### I-AC03: 完整风险覆盖保持通过

完整层仍验证事件流、事务、Git 拓扑、跨进程 CLI 和发布相关路径，且相关 targeted tests、`pnpm check:sanity` 与 release-grade 检查全部通过。

## Verification evidence

- 参考环境保持为 Windows、Node.js v24.11.1、`availableParallelism=20`。
- `pnpm test:integration:built` 连续三次均为 122 项、120 通过、2 跳过、
  0 失败；墙钟时间为 73.2、72.4、70.0 秒，中位 72.4 秒，最大
  73.2 秒。
- `pnpm test:integration:extended:built` 为 35 项全部通过，耗时
  102.1 秒；`pnpm test:integration:all:built` 为 157 项、155 通过、
  2 跳过、0 失败，独立运行耗时 155.3 秒。
- `pnpm test:integration:platform:built` 的 4 项真实平台 smoke 全部通过，
  耗时 17.8 秒。live external 保持显式 opt-in，不属于无凭据门禁。
- V1/V2 fixture remote 隔离、selected-idea fast smoke、CI 路由、npm
  release 路由、behavior manifest 和 run-checks 合同均通过。
- `pnpm check:sanity`、`pnpm check:commit` 与 release-grade
  `pnpm check` 全部通过；后者执行 complete non-live integration，结果仍为
  157 项、155 通过、2 跳过、0 失败。
