# 评估 npmx.dev 依赖升级与替换建议

## 意图

系统性评估并决定 npmx.dev 针对当前直接依赖提出的升级（commander、react-devtools-core）及替换建议（string-width），保持 runtime 行为稳定并理清依赖关系。

## 背景

npmx.dev 审计工具针对项目依赖提出了三项提示：
1. `commander` 可升级至 `15.0.0`（当前为 `14.0.3`）。
2. `react-devtools-core` 提示升级至 `8.0.0`（当前为 `7.0.1`）。经排查，该包系 `@opentui/react` 声明的 peerDependency（范围要求为 `^7.0.1`），并非项目直接业务引用，盲目升至 8.0 将导致 peer 约束破损。
3. `string-width`（用于 CJK 字符对齐）提示可替换为 `fast-string-width`。

需要通过正式的工程验证，评估 Commander 升级成本与潜在破坏、确认 peerDependency 规范与生命周期，并权衡替换库的收益与风险。

## 期望结果

### 1. Commander 升级评估
验证 Commander v15 在当前项目 CLI 解析、参数错误处理及 options 绑定中的兼容性，确定是否升级并完成充分测试覆盖。

### 2. Peer 依赖约束与清理明确
明确 `@opentui/react` 及其 peer 依赖（`react-devtools-core`、`ws`）的依赖声明规范，防止脱离上游约束升级引发不可预期的运行时行为。

### 3. string-width 替换收益与兼容性权衡
对 `string-width` 与建议的替代库（如 `fast-string-width`）进行基准评估，若无实质收益或存在语义不一致风险则维持稳定依赖。

## 范围

### 范围内

- 验证并升级 `commander` 到 v15，确保现有 CLI 功能与测试套件完全兼容。
- 审查 `react-devtools-core` 的版本边界，根据上游 `@opentui/react` 的支持情况决定版本对齐策略。
- 评估 `string-width` 是否需要替换为 `fast-string-width`，记录评估决策与测试数据。

### 范围外

- 替换或重构 OpenTUI / React TUI 核心渲染架构。
- 升级未在本次 npmx 范围内的其他间接依赖。

## 约束

- 必须保证 `pnpm check:sanity`、`pnpm check:commit` 及 `pnpm check` 全部通过。
- 遵循 Node >= 22 的平台与引擎限制。
- 不能打破 `@opentui/react` 声明的 peerDependencies 约束。

## 待解决问题

### Commander v15 是否存在对当前选项冲突声明的破坏性行为变更
需要在实施准备中编写专项契约测试进行回归验证。
