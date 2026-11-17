# 将 Silvermoon 收敛为 Idea 契约驱动的自主交付

## 问题

原 objective guide 的多级 Objective 将被 task-engine 与 check 体系替代。
实际使用中，人很少 review impl/deploy，Inner 与 Outer 人工门限未产生预期价值。

## 结果

人在 Idea 讨论中明确 Inner 与 Outer 的成功条件；确认后由 Agent 自主推进交付。
检查通过或报告问题，不再以 Objective 等级描述进度。

## 边界

- 使用 `@silvermoon-work/task-engine` 和 okr-agent 项目定义的 check，具体接口待核实。
- 将成功条件的讨论前移，而非把详细实施计划全部前置。
- 本次先保存方向，尚未验收或授权实施；建议与待定问题见[讨论记录](./discussion.md)。

## 验收标准

1. 各类检查可给出通过或具体问题，不再依赖多级 Objective。
2. Idea 明确 Inner 与 Outer 成功条件，常规交付不再等待 impl/deploy 人工验收。
3. Agent 能持续推进并用证据说明完成；异常、授权与条件变更边界有明确约定。

## 下一步

回家后继续讨论并确认交付边界与状态模型，区分已提出的方向和待确认建议。
