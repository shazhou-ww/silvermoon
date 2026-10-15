# 简化递进 Objective 的 Reference lookup

## 问题

Device `whats-next` 的 Agent 输出会在 `References` 中分别给出 level、check 和 problem 的完整 lookup 命令。多层 objective 需要重复指定 lookup，`page` 及 `level`、`problem` 等类型标识也占据独立参数，使默认输出冗长。

## 结果

Reference lookup 不再要求 Agent 指定 Idea、Project 或 Device；运行时递归解析页面 owner。`page` 不再作为独立子命令，`level`、`check`、`problem` 等类型改为可选的冒号 namespace；省略 namespace 时跨 Objective 与类型自由匹配，只有唯一命中才直接打开。默认 References 不因层级存在就单独列出 Device level 页面，同时保留有用下钻和结构化 Reference 契约。

命令的 before/after、参数结构与递归解析规则见 [Reference 命令结构设计](./Reference-command-shape.md)。

## 边界

- 保留 check/problem 按需下钻、明确无歧义的页面寻址和结构化 Reference 参数。
- 同步 en-US、zh-CN 契约、测试和文档；非 References 报告语义不变。
- 不修改 `device-runtime-not-discoverable` 当前文案，也不把其 review 合并到本 Idea。

## 验收标准

- 对三层递进 objective 的 Reference lookup 无需指定 Objective，并能递归解析目标页面的实际 owner。
- `page` 不再作为子命令，类型使用可选冒号 namespace；显式 namespace 可精确定位，省略时唯一命中直接打开、歧义时返回候选，check/problem 下钻与结构化参数不丢失。
- Device 默认 References 不再仅因层级存在而包含 level 页面；双语输出、测试和文档与递进 lookup 规则一致。
