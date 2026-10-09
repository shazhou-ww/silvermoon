# Implementation

## Steps

### I-S01: 演进事件记录契约

新 canonical 记录不再写 sequence，并由 CLI 增加 UTC 毫秒 RFC 3339 timestamp；
读取层兼容含 sequence 或缺少 timestamp 的旧记录，不重写历史或伪造时间；
校验层跳过缺失值并要求其余 timestamp 按事件顺序非递减。

### I-S02: 重构 append 并发与重试

让 optional expected digest 接受至少 8 位的前缀匹配；拒绝调用方 timestamp，
新 append 的本机时间早于最近一个有 timestamp 的事件时拒绝写入并区分日志
异常与时钟回拨诊断；紧邻相同业务事件的重试返回 `already-present`、
`written: false` 并保留首次 timestamp。sequence 仅由位置派生。

### I-S03: 同步验证面

更新迁移、CLI、reducer、report、schema、文档和测试，保留 replay 的调试与
增量读取职责以及无 digest append 的兼容行为。

## Acceptance criteria

### I-AC01: 事件记录自描述

自动化测试证明新记录包含 CLI 生成的 UTC 毫秒 timestamp 且不含 sequence，
读取结果按文件位置派生序号，旧格式保持可读，缺失时间被跳过且不被伪造。

### I-AC02: Digest 前缀控制写入

自动化测试证明 7 位前缀被拒绝，并覆盖 8 位、中间长度与完整 digest 的成功
匹配；不匹配时文件字节不变，省略 digest 时 append 仍正常执行。

### I-AC03: 重试与指引保持一致

集成测试证明相等或递增时间可写入、倒序日志和本机时钟回拨均在写入前停止并
给出准确诊断；相同业务请求重试返回 `already-present` 且不重复写入，并保留
首次 timestamp；report 输出可执行 digest 指引。
