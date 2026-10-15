# Implementation

## Steps

### I-S01: 收敛默认引用契约

明确 Device level、check 与 problem Reference 的默认选择规则，以及可从报告上下文继承并省略的命令参数。

### I-S02: 实现紧凑命令与兼容解析

更新报告投影和 `reference page` 解析，使紧凑命令可直接执行，同时保留既有完整命令与结构化 Reference contract。

### I-S03: 同步双语契约与覆盖

更新 en-US、zh-CN 文案契约、测试夹具和相关文档，覆盖默认选择、紧凑调用与下钻行为。

## Acceptance criteria

### I-AC01: 默认集合精简

Device Agent 报告不再自动展示无独立价值的 level Reference；通过相关报告快照和契约测试证明 check/problem 仍按规则出现。

### I-AC02: 紧凑调用等价

紧凑命令与既有完整命令解析到相同页面，且无歧义地保留 objective、reference path 与 language 上下文；通过 CLI 集成测试证明。

### I-AC03: 契约一致且回归通过

结构化 Reference 字段、en-US/zh-CN 输出和文档描述一致，相关单元、集成与仓库检查全部通过。
