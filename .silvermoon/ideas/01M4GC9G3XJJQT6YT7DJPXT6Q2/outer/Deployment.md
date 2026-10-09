# Deployment

## Steps

### D-S01: 验证发布接口

在发布级检查与打包 smoke 中验证 optional digest 参数、冲突诊断和
`what's-next` 指引、无 sequence 记录与 append timestamp 可由安装包正常使用。

### D-S02: 发布兼容说明

在直接相关文档中明确事件顺序与 timestamp 语义、历史兼容边界、digest 前缀
匹配规则、无 digest 行为以及 replay 的调试/增量读取定位。

## Acceptance criteria

### D-AC01: 发布级验证通过

`pnpm check` 的 schema、迁移、CLI、集成、e2e 与 pack 检查证明发布接口和
安装包行为一致。

### D-AC02: 使用者可区分 append 与 replay

维护文档和 Agent skill 明确文件顺序、timestamp 与派生序号的职责，生产 append
使用 `what's-next` 提供的 digest，而 replay 保留为调试与增量读取工具。
