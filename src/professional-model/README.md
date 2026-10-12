# Professional model

此独立仓库内 module 负责专业能力契约、声明式 YAML 验证与有序原子检查拼装。
公共入口仅为 `index.ts`；不包含 Silvermoon 的领域报告、Git 操作、生命周期
决定或自动执行 skill 的行为，也不独立发布 npm 包。

## Capability boundary

运行器验证目标，按层逐关执行，在首失败处停止；一次观察由 registry factory
注入 useState，注册独立的 `[getState, setState]` 句柄供异步 check 共享最新值，
不使用 React 或隐式全局上下文。领域检查负责采样、时效、版本证据及预期不可用的显式 problem。
配置和程序缺陷不能被正常业务未达成掩盖。

## Key exports

`assembleProfessionalModel`、`ProfessionalModel`、固定 `Target`、
`Observation`、`Problem`、`AtomicCheck`、`CheckResult`、
`UseState`、`StateHandle`、`ConfigurationError` 与 `TargetError`。

完整契约与 Silvermoon 接入边界见[专业能力说明](../../docs/professional-model.md)。
