# Deployment

## Steps

### D-S01: 验证发布接口

在发布级检查与打包 smoke 中验证 optional digest 参数、冲突诊断和
`what's-next` 指引可由安装包正常使用。

### D-S02: 发布兼容说明

在直接相关文档中明确 digest CAS 为可选保险、无 digest 行为以及 replay 的
调试/增量读取定位。

## Acceptance criteria

### D-AC01: 发布级验证通过

`pnpm check` 的 CLI、集成、e2e 与 pack 检查证明发布接口和安装包行为一致。

### D-AC02: 使用者可区分 append 与 replay

维护文档和 Agent skill 明确生产 append 使用 `what's-next` 提供的 digest，
而 replay 保留为调试与增量读取工具。
