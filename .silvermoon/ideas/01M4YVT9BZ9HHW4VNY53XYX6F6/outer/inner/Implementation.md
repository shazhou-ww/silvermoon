# Implementation

## Steps

### I-S01: 明确递归 lookup 与引用路径

明确如何递归收集三层 Objective 页面、用可选冒号 namespace 精确读取单页，以及无 namespace 复用现有搜索并处理唯一、多项和零结果；同时确定默认展示哪些 References。

### I-S02: 实现递进 objective lookup

更新报告投影与 CLI 解析，使 lookup 无需 Objective 参数即可递归解析 owner，显式 namespace 可精确读取单页，无 namespace 搜索时唯一命中自动打开、多命中返回列表，并保留结构化 Reference contract。

### I-S03: 同步双语契约与覆盖

更新 en-US、zh-CN 文案契约、测试夹具和相关文档，覆盖递归查找、可选 namespace、跨 Objective 搜索、Device 默认选择和按需下钻。

## Acceptance criteria

### I-AC01: 递归查找三层 objective

对代表性的三层递进 objective，不指定 Objective 即可查到目标页面并返回实际 owner；通过 CLI/集成测试证明，不要求 Agent 判断页面层级。

### I-AC02: Namespace 解析明确且下钻保真

`page` 子命令移除后，显式冒号 namespace 可无歧义读取页面；无 namespace 时唯一命中自动打开、多命中返回列表、零命中返回空结果，并保留 owner、language 和结构化参数；check/problem 下钻通过 CLI 测试证明。

### I-AC03: 契约一致且回归通过

Device 默认输出不再仅因层级存在而列出 level 页面；双语输出、结构化 Reference contract、文档描述及相关回归测试一致。
