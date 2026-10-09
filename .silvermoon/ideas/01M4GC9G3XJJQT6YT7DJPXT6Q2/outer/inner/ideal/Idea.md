# 简化 event append 乐观锁

## 问题

生产态 `event append` 当前把 event replay 的 length/digest cursor 暴露给
Agent，并强制依赖 replay 获取写入前置条件。这混淆了调试、增量读取与基础
乐观锁，也让 `what's-next` 无法直接给出完整、安全的 append 指引。

## 结果

`what's-next` 直接观察并输出完整 `events.jsonl` 的 Git blob digest；
`event append` 可选接收该 digest，匹配时正常追加，不匹配时明确报告乐观锁
冲突。未提供 digest 时不执行乐观锁检查。

## 边界

- sequence 不参与乐观锁，仍由 event reducer 从历史派生。
- length 只服务于 replay 的增量读取等独立能力，不属于生产 append 的 CAS。
- 不改变 canonical lifecycle state、事件类型或 `events.jsonl` schema。

## 验收标准

- `what's-next --audience agent` 为选中 v2 idea 返回观察到的 event digest，并给出
  使用该 digest 的准确 append 指引。
- 提供匹配 digest 的 append 成功；提供不匹配 digest 时不写入并报告明确的
  optimistic-lock conflict。
- 未提供 digest 的 append 保持可用且不执行 CAS；生产提示不再要求先运行
  `event replay`。
