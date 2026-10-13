# 规范目标向导与多目标监督

## 问题

现有专业能力 module 已验证单一目标维度的观察、问题与指导可以驱动 `whats-next`，但它尚未规范目标损益、Agent 单步处置闭环和多目标资源取舍的概念边界。原有物理场代号也不适合作为公开工程接口。

## 结果

在已验证的专业能力基础上，形成 ObjectiveGuide（OG）、ObjectiveRegulator（OR）与 Objective Portfolio Supervisor（OPS）的公开术语和可实施 TypeScript 契约；明确 Manifest、同目录代码与文档只组成 OG 传输单元，运行时代码仅使用装载后的 ObjectiveGuide。语义见[目标导向体系](./professional-model.md)，理论溯源与例子见[推演说明](./value-field-reasoning.md)。

## 边界

- 公开接口不使用势场、势能等物理隐喻；内部理论仍可追溯离散单洼地标量势场。
- 本轮规范类型和职责边界，不实现生产级 OR 循环、OPS 调度算法、跨行业能力或独立 npm 发布。
- 层级仅为单目标内的序数且允许中间稳态；观察不是原子快照，任何 Agent 行动都须重新观测，人工决定不得自动替代。

## 验收标准

- 类型契约严格分离 OG 的领域知识、OR 的单目标闭环与 OPS 的多目标权衡，并定义可判定的终止结果。
- Manifest 只承担可序列化声明与资源索引，默认 loader 可绑定同一 OG 传输单元内的代码和文档并返回 ObjectiveGuide；OR 与 OPS 不感知传输结构。
- 新契约明确映射现有 ProfessionalModel 基线并保留 `whats-next` 行为；下游实现和部署种子不预先宣称 OR 或 OPS 已可运行。
