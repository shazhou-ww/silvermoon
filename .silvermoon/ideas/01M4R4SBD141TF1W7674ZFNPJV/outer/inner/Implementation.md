# Implementation

## Steps

### I-S01: 演进 ObjectiveGuide 基础契约

按[核心类型契约](./ideal/objective-guidance.md)实现 Loader、语言中立 Guide、
subject/language-bound instance、Manifest 和 References；复用现有
ProfessionalModel 基线与有类型的执行依赖。

### I-S02: 接入三个作用域的 Guide

按[Silvermoon 领域契约](./ideal/silvermoon-objectives.md)落实 Device、Project 和
Idea 的 levels/checks、Project→Idea prerequisite 及命令路由。项目 guidance
检查和 Idea submit/accept 分层按契约接入；OR/OPS 只保留扩展文档。

### I-S03: 保持现有导航兼容

补充核心与实际 CLI 兼容测试，更新相关文档；保留四投影、诊断优先级、设备
advisory、语言、精确 revision 与人工交接。显式验证领域契约声明的 guidance
检查范围扩展，不引入其他隐式行为变化。

## Acceptance criteria

### I-AC01: OG 传输与运行时边界可验证

类型检查与专项测试覆盖核心契约的 URI identity/cache、typed creation failures、
定义域与受限 JSONata、locale 完整性、有序 level descriptions 和 References
默认/覆盖 not-found 行为；错误不伪装成成功。

### I-AC02: 三个作用域的契约可验证

专项与 CLI 测试覆盖领域契约的每层 checks：配置兜底、非阻塞设备 advisory、
Project prerequisite、项目 guidance 缺失/非法/primary snapshot、无 selector
仅做项目级导航、无效 selector、准确与 stale submission/acceptance、
v1 兼容和 abandoned/completed。源码与导出检查证明无 OR/OPS 依赖；
`list-ideas` 和 snapshot `check` 不新增同步、网络或设备 readiness 门槛。

### I-AC03: 仓库验证通过

运行 `pnpm check:sanity` 与专项测试，交付前 `pnpm check`，提交前
`pnpm check:commit`，记录精确命令与结果。经全局运行时 worktree/staged 检查后
普通提交及非强制同步，再对准确 implementationRevision 记录 submitInner；
不推断 acceptInner。
