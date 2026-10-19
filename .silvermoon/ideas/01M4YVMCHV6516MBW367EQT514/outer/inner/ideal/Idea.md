# 将 Objective Guide 实现迁移到已发布包

## 问题

Silvermoon 维护着一份 Objective Guide 核心实现，而上游已将其整理为可复用的公开包。继续维护重复实现会增加修复与行为对齐成本。

## 结果

Silvermoon 使用 `@potential-guide/objective-guide` 提供通用加载、校验、观测和 Reference 能力，同时保留 Silvermoon 自己的内置 Objectives、checks、报告与命令行为。

已核实的包版本、兼容风险和回归方向见[迁移策略](./migration-strategy.md)。

## 边界

- 这是核心实现的 refactor；不改变 Silvermoon 的 CLI UX、报告/序列化数据契约或 repository model。
- 只引入实际需要的 `@potential-guide/objective-guide`；不引入 regulator 或 portfolio supervisor，也不发布 `silvermoon` 的自依赖。

## 验收标准

- Objective Guide 的通用实现来自已发布包，本地实现及其仅限该实现使用的依赖在引用确认后移除。
- Silvermoon 现有命令输出与报告数据契约保持兼容；检查执行保持串行，并有测试覆盖新包同层问题聚合语义。
- 迁移相关测试、`pnpm check:sanity` 与 `pnpm check` 均通过，锁文件和打包清单反映迁移后的依赖与源码布局。
