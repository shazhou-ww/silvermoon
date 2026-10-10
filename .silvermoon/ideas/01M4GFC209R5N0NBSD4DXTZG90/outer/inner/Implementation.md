# Implementation

## Steps

### I-S01: 逐项 review catalog

按 `review-status.md` 的 pending 顺序检查每个 ID 的中英文模板、参数和调用约定，
每次只记录人工明确完成的 review。

### I-S02: 修正已确认问题

对 review 中确认的问题做精确修改，同步两种 locale、contract、routing 与直接相关
测试，不顺带修改未 review 项。

### I-S03: 收敛 review 状态

在每次人工 review 后更新清单，复核 catalog 对称性与 pending 数量，直到全部完成。

## Acceptance criteria

### I-AC01: 清单完整

自动化检查证明 review 清单与 template catalog 的 ID 集合完全一致。

### I-AC02: 状态有人工依据

review 记录证明每个 `reviewed` 状态均来自明确人工 review，不从实现或验证结果推断。

### I-AC03: 修正保持契约

模板、report 和类型测试证明已确认修正未破坏 locale 对称、routing 或外部输出契约。
