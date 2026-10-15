# 简化递进 Objective 的 Reference lookup

## 问题

Device `whats-next` 的 Agent 输出会在 `References` 中分别给出 level、check 和 problem 的完整 lookup 命令。多层 objective 需要重复指定 lookup，`page` 及 `level`、`problem` 等类型标识也占据独立参数，使默认输出冗长。

## 结果

Agent 只需从最外层 objective 发起 Reference lookup，由其递归委派内层 objective 查找目标页面；`page` 与 `level`、`problem` 等类型标识并入后续 lookup 路径，不再作为独立首层参数。默认 References 不因层级存在就单独列出 Device level 页面，同时保留有用下钻和结构化 Reference 契约。

## 边界

- 保留 check/problem 按需下钻、明确无歧义的页面寻址和结构化 Reference 参数。
- 同步 en-US、zh-CN 契约、测试和文档；非 References 报告语义不变。
- 不修改 `device-runtime-not-discoverable` 当前文案，也不把其 review 合并到本 Idea。

## 验收标准

- 对三层递进 objective 的 Reference lookup 只需从最外层发起，并能递归解析到内层目标页面。
- `page`、`level`、`problem` 等类型标识并入 lookup 路径后仍可明确区分页面，check/problem 下钻保留上下文，结构化 Reference 参数不丢失。
- Device 默认 References 不再仅因层级存在而包含 level 页面；双语输出、测试和文档与递进 lookup 规则一致。
