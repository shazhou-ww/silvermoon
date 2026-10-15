# Implementation

## Steps

### I-S01: 明确递归 lookup 与引用路径

明确最外层 objective 如何递归委派内层页面 lookup，以及 `page`、`level`、`problem` 类型标识如何并入后续 lookup 路径；同时确定默认展示哪些 References。

### I-S02: 实现递进 objective lookup

更新报告投影与 CLI 解析，使最外层 objective 能递归查找内层 Reference 页面，路径类型可无歧义解析，并保留结构化 Reference contract。

### I-S03: 同步双语契约与覆盖

更新 en-US、zh-CN 文案契约、测试夹具和相关文档，覆盖递归查找、类型路径、Device 默认选择和按需下钻。

## Acceptance criteria

### I-AC01: 递归查找三层 objective

对代表性的三层递进 objective，从最外层发起 lookup 即可查到内层目标页面；通过 CLI/集成测试证明，不要求 Agent 为每层单独调用。

### I-AC02: 类型路径明确且下钻保真

`page` 与 `level`、`problem` 等类型标识融合进 lookup 路径后可无歧义定位页面，保留 objective、language 和结构化参数；check/problem 下钻通过 CLI 测试证明。

### I-AC03: 契约一致且回归通过

Device 默认输出不再仅因层级存在而列出 level 页面；双语输出、结构化 Reference contract、文档描述及相关回归测试一致。
