# 改造方向讨论记录

## 用户提出的方向

2026-11-17 讨论，用户要求先建立 Idea，回家后继续；本记录不是构想验收。

1. 原 objective guide 体系被 `@silvermoon-work/task-engine` 体系替换，
   使用 okr-agent 项目定义的 check 做各类检查。无需 multiple level 的
   Objective，check 只判断通过或不通过，不通过就报告问题。
2. 大多数时候不会 review impl/deploy，Inner 与 Outer 的人工门限实际上无效。
   重要的是人与 Agent 讨论 Idea，在其中讨论清楚 Inner 与 Outer 的成功条件，
   把门限放在 Idea 讨论里，其余交付由 Agent 自主完成。

## Agent 提议，尚待用户确认

- 将产品定位收敛为“人确认交付契约，Agent 自主完成并举证”。
  保留 Ideal / Inner / Outer 的观察视角，但不把三个视角等同于三次人工审批。
- task-engine 承担任务执行，okr-agent 定义的 check 判断条件与报告问题，
  Silvermoon 持有 Idea、组织成功条件与证据、协调后续行动。
  这是职责划分建议，尚未核实上游接口。
- Implementation / Deployment 如保留，应是 Agent 可调整的计划和记录，
  而非等待人工批准的独立契约。Idea 不必预写完整实施方案。
- 普通检查失败由 Agent 尝试修复；需求歧义、授权不足或无法自行解决的阻塞
  才返回人。检查执行失败必须显式报告，不能伪装成业务通过或业务结论。
- Agent 不得为通过检查而自行降低已确认标准；没有实际证据不能宣称完成。
  等待外部结果应如实表达为等待，不用部署成功替代实际效果。

## 下次继续的问题

1. Idea 确认同时授权哪些动作？生产部署、破坏性动作和外部等待如何处理？
2. 哪些成功条件能直接由 check 判定，哪些需要外部证据或人类判断？
   条件发生实质变化时如何重新讨论和确认？
3. 取消常规 Inner / Outer 人工门限后，嵌套 world、逐层 accepted revision
   与审批事件哪些应删除，哪些应替换为契约版本和证据机制？
   现有 Idea 与事件历史如何兼容或迁移？

## 现有设计背景

- [核心概念与三阶段决策](../../../../../../docs/core-concepts.md)
- [现有 Objective Pilot 与检查协议](../../../../../../docs/objective-guidance.md)

本次只记录，不实现新流程，也不对当前 Idea 设置门限豁免或记录任何验收事实。
