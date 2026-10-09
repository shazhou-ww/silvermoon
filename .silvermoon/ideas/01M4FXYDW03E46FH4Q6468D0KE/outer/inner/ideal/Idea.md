# 用 Submit 事件标记 Agent 阶段完成

## 问题

`ping` 和 `pong` 是通用交互消息，不能准确表示 Agent 已完成某个 Silvermoon 阶段。缺少规范的阶段提交事实时，新 Agent 必须重新阅读代码、契约和 ledger，才能判断应继续工作还是请求上游验收。

## 结果

为 Ideal、Inner 和 Outer 三个阶段分别增加由 Agent 控制、绑定准确 world revision 的 `submitIdeal`、`submitInner` 和 `submitOuter` 事件，并与现有 `acceptIdeal`、`acceptInner` 和 `acceptOuter` 一一对应。`whats-next` 据此明确当前候选仍由 Agent 推进，还是已经提交给上游验收。

## 边界

- 保留 `ping`、`pong` 的通用交互消息语义及现有实现，不再用它们标记阶段完成。
- Submit 只记录 Agent 对准确 revision 的完成声明；只有对应 Accept 才能推进生命周期。
- world revision 变化后，旧 Submit 不得继续代表当前候选已提交；ledger 仍是辅助清单而非状态权威。

## 验收标准

- 事件协议能独立记录并重放三个 Submit 事实，且清楚标识其由 downstream Agent 发出并绑定对应 world revision。
- `whats-next` 能仅根据规范项目状态区分“Agent 继续推进”和“等待上游验收”，提交后提供对应 gate 的准确模板。
- 新 Agent 能从报告直接识别当前阶段是否已提交、是否因 revision 变化而失效，无需把 ledger checkbox 当作可信状态或重读全部实现。
