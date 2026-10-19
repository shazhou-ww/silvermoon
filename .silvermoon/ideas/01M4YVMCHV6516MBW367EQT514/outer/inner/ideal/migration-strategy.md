# Objective Guide 包迁移策略

## 已核实的上游包

上游仓库为 `shazhou-ww/potential-guide`。已发布的兼容基线为 `@potential-guide/objective-guide@0.1.0`，对应上游 `objective-guide-v0.1.0` tag；上游发布工作流成功，并记录了 provenance。Silvermoon 只消费这个核心包。`@potential-guide/objective-regulator` 与 `@potential-guide/objective-portfolio-supervisor` 虽也发布了 `0.1.0`，但不属于当前迁移范围。

核心包公开 `createObjectiveLoader`、文件资源与 check runner、URI canonicalization、projection 限制、配置/操作错误，以及 Guide、Instance、Observation、manifest 和 loader 相关类型。使用默认 loader 时，同一个 level 的 checks 串行执行（并发度为 1），但会继续执行该 level 的其余 checks，并按 manifest 顺序聚合失败问题；Silvermoon 不应注入更高并发度。

## 兼容策略

新版本的 observation 从旧版 `position` 改为 `current + problems`，移除了 observation 上的 `failingCheck`；问题仍以稳定 ID 和 parameters 表达。Silvermoon 的报告投影目前依赖所属 Objective、level、failed check 和完整问题列表。因此迁移时先设计并测试 adapter，保持既有 Silvermoon 报告形状，不将上游类型直接泄漏为新的 CLI/data contract；不得用不可靠推断填充 failed-check 字段。

包的公开 `ReferencePage` 类型不包含 `outcome` / `instruction`。核对运行时 Reference 解析和 Silvermoon 已有报告/Reference 渲染，确保迁移不丢失现有 guidance；若公开 API 无法满足这一点，应把具体差异作为实现前阻塞，而不是悄悄改变用户可见输出。

包声明 Node.js `>=22.13.0`，Silvermoon 当前声明 `>=22.12.0`。依赖接入前验证引擎范围，并只在符合兼容要求的情况下更新 Silvermoon 约束。

## 验证策略

迁移验证覆盖 package API 与 Silvermoon adapter、串行同层 checks 和聚合结果、既有报告/Reference 回归、删除本地实现后的引用与打包检查、`pnpm check:sanity` 和完整 `pnpm check`。
