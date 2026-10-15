# 接入 Potential Guide Objective 包

## Steps

### I-S01: 设计兼容适配

对照 `0.1.0` 的公开 API，为现有报告投影、Reference guidance 和串行 checks 定义经过测试的适配方式；遇到无法保持当前数据契约的差异时先停止并说明。

具体边界、实现选择与验证证据见[迁移实施说明](./migration-implementation.md)。

### I-S02: 替换本地核心

迁移 loader、内置 Objective adapter、测试、导出、文档和打包清单至 `@potential-guide/objective-guide`；确认无引用后删除重复实现与仅供其使用的依赖。

### I-S03: 完成回归验证

更新锁文件并运行迁移相关测试、sanity 和完整 check，保留现有 CLI/report/data contract 与默认串行行为。

## Acceptance criteria

### I-AC01: 使用已发布核心包

运行时通用 Objective Guide 能力来自准确锁定的公开包版本，本地重复实现没有残留引用，打包内容与依赖清单通过检查。

### I-AC02: 保持 Silvermoon 合同

报告、Reference 内容和输出数据结构保持迁移前契约；测试证明 checks 默认串行且新包的同层问题聚合行为被正确适配。

### I-AC03: 验证全部通过

迁移相关测试、`pnpm check:sanity` 和 `pnpm check` 均通过。
