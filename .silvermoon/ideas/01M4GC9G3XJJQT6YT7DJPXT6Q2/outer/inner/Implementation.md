# Implementation

## Steps

### I-S01: 定义 digest CAS 契约

调整 append 输入与业务边界，使 optional expected digest 接受至少 12 位的
十六进制前缀，并与完整 `events.jsonl` Git blob digest 执行前缀匹配，返回
稳定的输入或冲突诊断。

### I-S02: 将 digest 接入 what's-next

在 v2 idea 观察与 report 中携带 event digest，由 routing 生成准确 append
指引，并移除生产 lifecycle 文案对 replay cursor 的依赖。

### I-S03: 同步验证面

更新直接相关的 CLI、业务、report、文档和测试，保留 replay 的调试与增量读取
职责以及无 digest append 的兼容行为。

## Acceptance criteria

### I-AC01: Digest 匹配控制写入

自动化测试覆盖 12 位、介于下限与完整 OID 之间以及完整 digest 的成功匹配；
短于下限或前缀不匹配时文件字节不变并返回明确诊断。

### I-AC02: 无 digest 保持可用

自动化测试证明省略 optional digest 时 append 正常执行，sequence 继续由 reducer
派生。

### I-AC03: Report 提供完整生产指引

模板与集成测试证明 `what's-next` 输出观察 digest 和可执行 append 指引，且不要求
生产 Agent 先调用 `event replay`。
