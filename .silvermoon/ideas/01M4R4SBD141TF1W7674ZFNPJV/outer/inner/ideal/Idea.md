# 建立 Objective Guidance 类型体系

## 问题

现有专业能力 module 已验证单一目标维度的观察、问题与指导可以驱动 `whats-next`，但它尚未规范目标损益、Agent 单步处置闭环和多目标资源取舍的概念边界；扁平 guidance 与独立 docs 也无法表达问题、处置方法和知识依据之间的复用关系。

## 结果

形成可复用的 ObjectiveLoader、语言中立 ObjectiveGuide 和 subject/language-bound ObjectiveGuideInstance 核心契约，并明确 Silvermoon 设备、项目、Idea 三个作用域的层级与 checks。类型见[核心契约](./objective-guidance.md)，领域判据与路由见[Silvermoon 领域契约](./silvermoon-objectives.md)；[ObjectiveRegulator](./objective-regulator.md) 与 [Objective Portfolio Supervisor](./objective-portfolio-supervisor.md) 保留为可选扩展，理论见[推演说明](./value-field-reasoning.md)。

## 边界

- 公开接口不使用势场、势能等物理隐喻；内部理论仍可追溯离散单洼地标量势场。
- 本轮只把 Guide 核心落入 Silvermoon 实现范围；OR 与 OPS 保留为独立扩展文档，不进入当前 source/runtime 依赖。本轮也不规定知识页面的领域分类或目录层级，不实现通用知识平台、跨行业能力或独立 npm 发布。
- 层级只由单目标内有序、可读且稳定的 level ID 表达并允许中间稳态；公共契约不暴露 numeric level/index。观察不是原子快照，任何 Agent 行动都须重新观测，人工决定不得自动替代。

## 验收标准

- [核心契约](./objective-guidance.md)明确 URI 身份、Guide/Instance 边界、typed creation failures、定义域与 prerequisite projection、多语言、有序 level 与平级 reference pages；不重复暴露 numeric index、通用 runtime context 或可派生中间对象。
- [领域契约](./silvermoon-objectives.md)明确三个作用域的配置兜底与 checks、非阻塞 Device、Project→Idea 前置、项目级 guidance、selector 路由和精确 submit/accept 分层；配置、装载与 instance 创建错误不混淆。
- 映射现有 ProfessionalModel 基线，保留导航的四投影、语言、控制权与精确 revision；项目 guidance 校验范围扩展明确标出并验证，OR/OPS 不进入当前 source/runtime。设计只定义在 Ideal World 辅助文件，实现契约仅列 Steps 与可验证 AC。
