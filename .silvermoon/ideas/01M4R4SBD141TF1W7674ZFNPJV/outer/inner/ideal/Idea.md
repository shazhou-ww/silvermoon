# 建立 Objective Guidance 类型体系

## 问题

现有专业能力 module 已验证单一目标维度的观察、问题与指导可以驱动 `whats-next`，但它尚未规范目标损益、Agent 单步处置闭环和多目标资源取舍的概念边界；扁平 guidance 与独立 docs 也无法表达问题、处置方法和知识依据之间的复用关系。

## 结果

在已验证的专业能力基础上，形成 ObjectiveLoader、ObjectiveGuide（OG）、ObjectiveRegulator（OR）与 Objective Portfolio Supervisor（OPS）的公开术语和可实施 TypeScript 契约；用一份语言无关的语义 Manifest 配合完整 locale content 与平级 reference pages，在不复制 checks、定义域或层级结构的前提下提供多语言知识。问题页面只承担入口角色，Agent 从问题入口主动读取和搜索知识，而不是由工具预取指导子图。语义见[Objective Guidance 类型体系](./objective-guidance.md)，理论溯源与例子见[推演说明](./value-field-reasoning.md)。

## 边界

- 公开接口不使用势场、势能等物理隐喻；内部理论仍可追溯离散单洼地标量势场。
- 本轮规范类型、职责与 references 装载边界，不规定知识页面的领域分类或目录层级，也不实现通用知识平台、生产级 OR 循环、OPS 调度算法、跨行业能力或独立 npm 发布。
- 层级仅为单目标内的序数且允许中间稳态；观察不是原子快照，任何 Agent 行动都须重新观测，人工决定不得自动替代。

## 验收标准

- 类型契约严格分离 OG 的领域知识、OR 的单目标闭环与 OPS 的多目标权衡；Manifest 用受限 Draft 2020-12 `domainSchema` 描述可接受的 project/Idea subject，公共 Objective API 只接收 subject，不暴露通用 runtime context；执行依赖由 bindings 注入，窗口和预算归 OPS policy。
- Objective 以 canonical Manifest URI 作为唯一身份，Loader 按 URI 与 resolved language 缓存 Guide；Manifest 内不重复声明身份字段。Manifest 用稳定 level ID 保存同型、都带 advancement 的本地显式层，全部通过后合成唯一 terminal“价值达成”层；完整 locale bundles 提供价值描述、层级文本、单段 outcome prompt 和 References，`describeLevels` 返回引用实际 Guide 的完整静态 descriptions。Project→Idea 等单个 optional `prerequisite` 以 Manifest URI 引用目标，其 `subject` 用受限 JSONata 投影当前定义域；Loader 递归解析为同语言 Guide 对象，未 terminal 时直接返回其 observation。Observed problem 直接给出入口 page ID，Agent 调用 observation 当前 Guide 的 `readPage`；OPS 不重写层级组合。
- 新契约明确映射现有 ProfessionalModel 基线并保留 `whats-next` 行为；下游实现和部署种子不预先宣称 OR 或 OPS 已可运行。
