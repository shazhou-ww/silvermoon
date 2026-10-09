# 简化 event append 与事件记录

## 问题

`events.jsonl` 持久化了可由文件位置推导的 sequence，却没有事件创建时间；
读取时间只能反查 Git 历史。生产态 `event append` 还把 replay 的
length/digest cursor 暴露给 Agent，混淆了增量读取与基础乐观锁。

## 结果

新 append 的事件不再存储 sequence，而由读取顺序派生序号；CLI 在首次写入时
记录规范 UTC timestamp。`what's-next` 直接输出完整 event digest，
`event append` 可选接收不少于 8 位的 digest 前缀作为乐观锁。

## 边界

- 文件顺序是 canonical 顺序；sequence 只可作为 replay/reducer 的派生投影，
  不再写入新事件或写入请求；含 sequence 的旧记录保持只读兼容。
- timestamp 是 CLI 首次成功 append 时生成的 UTC 毫秒 RFC 3339 时间，不接受
  调用方输入，也不替代文件顺序、授权或 commit 时间；旧事件不伪造时间。
- length 仅服务 replay；digest 不要求固定为 40/64 位或完整 OID，达到 8 位
  下限的十六进制前缀均可匹配，且不改变 lifecycle 状态或事件类型。

## 验收标准

- 新 append 的 canonical 记录包含规范 UTC timestamp 且不含 sequence；replay
  仍按文件位置提供稳定派生序号，含 sequence 或缺少 timestamp 的历史记录
  保持可读且不会被赋予虚假的创建时间。
- 至少 8 位且匹配的 digest 前缀允许 append；短于下限或不匹配时不写入并给出
  明确诊断，未提供 digest 时保持可用。
- `what's-next --audience agent` 给出可直接使用的 digest append 指引；不确定重试
  识别已写入事件并保留其原 timestamp，无需为新事件执行 Git blame。
