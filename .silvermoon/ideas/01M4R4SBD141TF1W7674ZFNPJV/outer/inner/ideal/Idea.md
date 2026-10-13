# 建立 Objective Guidance 类型体系

## 问题

现有专业能力 module 已验证单一目标维度的观察、问题与指导可以驱动 `whats-next`，但它尚未规范目标损益、Agent 单步处置闭环和多目标资源取舍的概念边界；扁平 guidance 与独立 docs 也无法表达问题、处置方法和知识依据之间的复用关系。

## 结果

在已验证的专业能力基础上，为 Silvermoon 形成 ObjectiveLoader、语言中立 ObjectiveGuide（OG）和 subject/language-bound ObjectiveGuideInstance 的公开术语与可实施 TypeScript 核心契约；用一份语言无关的语义 Manifest 配合完整 locale content 与平级 reference pages，在不复制 checks、定义域或层级结构的前提下提供多语言知识。问题页面只承担入口角色，Agent 从问题入口主动读取和搜索知识，而不是由工具预取指导子图。核心语义见[Objective Guide 类型体系](./objective-guidance.md)，后续自动闭环与多目标调度分别见独立的 [ObjectiveRegulator](./objective-regulator.md) 和 [Objective Portfolio Supervisor](./objective-portfolio-supervisor.md) 扩展契约，理论溯源与例子见[推演说明](./value-field-reasoning.md)。

## 边界

- 公开接口不使用势场、势能等物理隐喻；内部理论仍可追溯离散单洼地标量势场。
- 本轮只把 Guide 核心落入 Silvermoon 实现范围；OR 与 OPS 保留为独立扩展文档，不进入当前 source/runtime 依赖。本轮也不规定知识页面的领域分类或目录层级，不实现通用知识平台、跨行业能力或独立 npm 发布。
- 层级只由单目标内有序、可读且稳定的 level ID 表达并允许中间稳态；公共契约不暴露 numeric level/index。观察不是原子快照，任何 Agent 行动都须重新观测，人工决定不得自动替代。

## 验收标准

- 核心类型严格分离语言中立 OG 与绑定 subject/language 的 ObjectiveGuideInstance；Manifest 用受限 Draft 2020-12 `domainSchema` 描述可接受的 project/Idea subject，`createInstance` 以同步 discriminated result 区分根 subject 无效、prerequisite chain 的投影 subject 无效和 chain 中 language 不受支持，不用 Promise rejection 表达这些预期失败；成功后 Objective API 不重复接收 subject，也不暴露通用 runtime context，执行依赖由 bindings 注入。
- Objective 以 canonical Manifest URI 作为唯一身份，Loader 只按 URI 缓存语言中立 Guide；Guide 为每个确定的 subject 与 language 创建不可变 instance，Loader 不按任意 JSON subject 缓存 instance。Manifest 用有序、可读且稳定的 level ID 保存同型、都带 advancement 的本地显式层，全部通过后合成唯一 terminal“价值达成”层；完整 locale bundles 提供价值描述、层级文本、单段 outcome prompt 和 References，instance 的 `describeLevels` 返回引用实际 instance 的完整静态 descriptions，并把单段损益直接拍平为 `advancementOutcome`，不再返回 numeric level/index 或单字段 advancement 对象。Project→Idea 等单个 optional `prerequisite` 以 Manifest URI 引用目标，其 `subject` 用受限 JSONata 投影当前定义域；Loader 解析为 Guide 对象，instance 再以同一 language 和投影 subject 创建 prerequisite instance，未 terminal 时直接返回其 observation。Observed problem 直接给出入口 page ID，Agent 调用 observation 当前 instance 的 `readPage`；ReferencePage 不单列 links、tags 或 unknown-problem 布尔值，内部链接直接属于正文，缺页返回 locale 配置的普通 `notFoundPageId` 页面。
- 新契约明确映射现有 ProfessionalModel 基线并保留 `whats-next` 行为；Silvermoon source 只依赖 Guide 核心，OR 与 OPS 的独立扩展文档不得被误报为当前运行能力。
