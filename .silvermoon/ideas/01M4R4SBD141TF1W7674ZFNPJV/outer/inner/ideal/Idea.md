# 建立 Objective Guidance 类型体系

## 问题

现有专业能力 module 已验证单一目标维度的观察、问题与指导可以驱动 `whats-next`，但它尚未规范目标损益、Agent 单步处置闭环和多目标资源取舍的概念边界；扁平 guidance 与独立 docs 也无法表达问题、处置方法和知识依据之间的复用关系。

## 结果

在已验证的专业能力基础上，形成 ObjectiveGuide（OG）、ObjectiveRegulator（OR）与 Objective Portfolio Supervisor（OPS）的公开术语和可实施 TypeScript 契约；用平级 reference pages 及相互链接组成参考知识集，问题页面只承担入口角色，Agent 从问题入口主动读取和搜索知识，而不是由工具预取指导子图。语义见[Objective Guidance 类型体系](./objective-guidance.md)，理论溯源与例子见[推演说明](./value-field-reasoning.md)。

## 边界

- 公开接口不使用势场、势能等物理隐喻；内部理论仍可追溯离散单洼地标量势场。
- 本轮规范类型、职责与 references 装载边界，不规定知识页面的领域分类或目录层级，也不实现通用知识平台、生产级 OR 循环、OPS 调度算法、跨行业能力或独立 npm 发布。
- 层级仅为单目标内的序数且允许中间稳态；观察不是原子快照，任何 Agent 行动都须重新观测，人工决定不得自动替代。

## 验收标准

- 类型契约严格分离 OG 的领域知识、OR 的单目标闭环与 OPS 的多目标权衡，并定义可判定的终止结果。
- Manifest 以数组下标定义 level，并用可选 advancement 聚合进阶到下一层的 checks 与单段 outcome prompt；最高层 advancement 为 null。Manifest 只声明 references 位置，页面自身声明稳定 ID、问题入口、开放标签和内部链接，Agent 通过运行时 `ObjectiveReferences` 主动查询，OR 与 OPS 不感知传输结构。
- 新契约明确映射现有 ProfessionalModel 基线并保留 `whats-next` 行为；下游实现和部署种子不预先宣称 OR 或 OPS 已可运行。
