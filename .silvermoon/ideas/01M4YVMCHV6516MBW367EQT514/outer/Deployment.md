# 验证包迁移候选

## Steps

### D-S01: 验证仓库候选

按 Silvermoon 仓库流程验证迁移后的 worktree、测试与包内容；只在明确授权后提交或同步，不发布 npm 包。

## Acceptance criteria

### D-AC01: 仓库候选可交付

迁移候选通过仓库要求的 sanity、完整检查及打包检查；变更不触发 Silvermoon 包发布或自依赖。

## 交付证据

已验收实现 `262e4c738731` 的代码提交
[`e97c76deb321`](https://github.com/shazhou-ww/silvermoon/commit/e97c76deb321ef5cbc586b4db9ef2c90ab7b3ac9)
已同步到 primary；实施验收记录
[`e1c909b25452`](https://github.com/shazhou-ww/silvermoon/commit/e1c909b25452fff8cb5643b1ebc2f686d2037646)
之后未改变已验收的源码、测试、依赖或锁文件。

- 在 primary 对齐的独立 worktree 再次运行 `pnpm check`：通过。
  包括 build/typecheck、232 项 unit/runtime tests、60 项 contract tests、
  打包白名单、安装后 CLI/API smoke、skill checks；integration 为
  160 项通过、2 项按既有 Windows 条件跳过，无失败项。
- 实施验收前后的 `pnpm check:commit` 均通过；该命令包含 sanity，
  最近一次 199 项 sanity tests 全部通过。
- 上述代码提交的
  [GitHub CodeQL 检查](https://github.com/shazhou-ww/silvermoon/actions/runs/38684061618)
  已完成且通过，覆盖 JavaScript/TypeScript 与 Actions；它不是完整测试 gate 的替代品。
- 安装后 smoke 验证真实打包制品能消费发布核心并运行现有 CLI/API；
  准确 package 版本与兼容说明见已验收的
  [实施证据](./inner/migration-implementation.md)，无需重复实现细节。

本次交付仅同步仓库候选，没有创建 PR、发布 npm 包、创建 npm release tag
或引入已发布 Silvermoon 自依赖。环境配置与临时日志仍只保留在 session。
