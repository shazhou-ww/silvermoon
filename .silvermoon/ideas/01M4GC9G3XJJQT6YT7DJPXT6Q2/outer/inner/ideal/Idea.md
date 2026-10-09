# 简化 event append 乐观锁

## 问题

生产态 `event append` 当前把 event replay 的 length/digest cursor 暴露给
Agent，并强制依赖 replay 获取写入前置条件。这混淆了调试、增量读取与基础
乐观锁，也让 `what's-next` 无法直接给出完整、安全的 append 指引。

## 结果

`what's-next` 直接观察并输出完整 `events.jsonl` 的 Git blob digest；
`event append` 可选接收不少于 12 位的 digest 前缀，并与观察到的完整 digest
执行前缀匹配。匹配时正常追加，不匹配时明确报告乐观锁冲突；未提供 digest
时不执行乐观锁检查。

## 边界

- sequence 不参与乐观锁，仍由 event reducer 从历史派生。
- length 只服务于 replay 的增量读取等独立能力，不属于生产 append 的 CAS。
- digest 参数不要求固定为 40/64 位或完整 OID；达到 12 位下限的十六进制前缀
  均可参与匹配，完整 digest 仍是合法输入。
- 不改变 canonical lifecycle state、事件类型或 `events.jsonl` schema。

## 验收标准

- `what's-next --audience agent` 为选中 v2 idea 返回观察到的 event digest，并给出
  使用该 digest 的准确 append 指引。
- 提供至少 12 位且匹配的 digest 前缀时 append 成功；短于下限的输入被拒绝，
  前缀不匹配时不写入并报告明确的 optimistic-lock conflict。
- 未提供 digest 的 append 保持可用且不执行 CAS；生产提示不再要求先运行
  `event replay`。
