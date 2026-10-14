# 用 Objective 统一 whats-next 报告

## 问题

`whats-next` 仍由大量场景模板分别拼装位置、问题和下一步，重复文案容易漂移，也没有
直接利用 Objective Guide 的 level/check/problems 与静态 Reference guidance。

## 结果

统一报告固定呈现两部分：动态的“当前停留位置”（Objective、level、check、problems）
和静态的“向下指引”（对应 Reference Pages）；动态路径、revision、命令作为结构化
本次上下文展示，terminal 明确没有 required next step。

## 边界

- 依赖 `whats-next-objective-targeting`、`objective-position-contract` 和
  `objective-reference-cli` 提供准确目标、位置与详情入口。
- static guidance 不吸收动态 facts；checks 也不返回最终本地化报告字符串。
- active idea inventory、review gate 等非 check 交互保留少量专用组件，不强塞进 Problem 模板。

## 验收标准

- Device、Project、Idea 的 blocked 与 terminal 语料使用同一 Objective report shell。
- 每个 Problem 的动态 parameters、静态 guidance、详情命令和 recheck action 均无遗漏。
- 旧完整场景 templates 被安全收敛，双语 corpus 证明无语义回退或重复下一步。
