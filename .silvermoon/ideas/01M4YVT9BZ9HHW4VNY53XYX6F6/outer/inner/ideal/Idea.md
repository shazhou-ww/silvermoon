# 压缩 whats-next 默认 References

## 问题

Device `whats-next` 的 Agent 输出会在 `References` 中同时给出 level、check 和 problem 三条完整命令。Device level Reference 的独立价值不明确，而重复的 objective、reference path 与 language 参数掩盖了当前行动。

## 结果

默认输出只展示能支持当前下钻的精简 Reference 集合，并以明显更短、仍可直接调用的命令表达。Device level Reference 不再仅因层级存在而默认出现；每个保留项仍维持结构化契约，并可按需打开完整页面。

## 边界

- 保留 check/problem 的按需下钻能力、完整命令兼容性与结构化 Reference 参数。
- 同步 en-US、zh-CN 契约、测试和文档，不改变非 References 的报告语义。
- 不修改 `device-runtime-not-discoverable` 当前文案，也不把其 review 合并到本 Idea。

## 验收标准

- 代表性 Device 报告默认不再展示无独立价值的 level Reference，且保留项的命令显著短于当前形式。
- 精简命令与完整命令均能解析到同一 Reference 页面，check/problem 下钻不丢失上下文。
- 结构化 Reference contract、双语输出、测试和用户文档对默认选择与命令形态保持一致。
