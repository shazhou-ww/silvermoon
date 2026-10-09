# Implementation

## Steps

### I-S01: 演进事件记录契约

从 canonical event schema 移除 sequence，为新 append 增加 CLI 生成的规范 UTC
timestamp，并为无可信 timestamp 的历史记录定义兼容迁移。

### I-S02: 重构 append 并发与重试

让 optional expected digest 接受至少 12 位的前缀匹配，并确保首次写入生成的
timestamp 在不确定重试中保持不变；sequence 仅由读取位置派生。

### I-S03: 同步验证面

更新迁移、CLI、reducer、report、schema、文档和测试，保留 replay 的调试与
增量读取职责以及无 digest append 的兼容行为。

## Acceptance criteria

### I-AC01: 事件记录自描述

自动化测试证明新记录包含规范 UTC timestamp、不含 sequence，读取结果按文件
位置派生序号，历史迁移不伪造未知时间。

### I-AC02: Digest 前缀控制写入

自动化测试覆盖下限、中间长度与完整 digest 的成功匹配；短输入或不匹配时文件
字节不变，省略 digest 时 append 仍正常执行。

### I-AC03: 重试与指引保持一致

集成测试证明重试保留首次 timestamp，且 `what's-next` 输出可执行 digest 指引，
不要求生产 Agent 先调用 `event replay` 或为新事件查询 Git 历史。
