# Implementation

前一 implementation revision 的验收已记录；以下内容随理想世界的新
命名和公开 v2 契约修订。先取得新 ideal revision 的明确批准，再完成
本轮实施与重新验证，不能沿用旧验收。

## Steps

### I-S01: 完成公开 v2 单词事件与完整投影

`schema/v2` 与项目 `version: 2` 保持唯一公开契约；九种事件为
`setAlias`、`setLanguage`、`acceptIdeal`、`acceptInner`、
`acceptOuter`、`abandon`、`resume`、`ping`、`pong`。保留旧事实
payload、status 字段及人类 gate；两种交互消息只含非空 `message`，
并增加有序消息投影和仅由 `ping/pong` 决定的球权。正常公开 v2
命令不接受旧点分事件。

### I-S02: 完成本仓库一次性内部格式迁移

只对 Silvermoon 自身现有旧点分日志提供独立、显式的内部迁移入口。
以准确摘要计划和刷新后的 primary 为前态，在可恢复事务中仅重命名
全部 idea 既有事件 type，保持序号、payload 和事实状态。建立能够
识别空日志的内部历史边界，旧 Git 提交按旧格式回放，之后按最终
`schema/v2` 回放并恢复 append-only；不新增公开版本或其他项目的
旧格式兼容，不由普通命令触发迁移。

### I-S03: 对接本地交互 CLI 和导航

沿用 `event replay/append/revise/recover`；本地 `ping/pong` 写入
绑定准确字节前态，不能被 fetch、commit 或 primary 故障锁死。
生命周期决定仍需精确 revision、primary 和人工授权。无状态 CLI
不认证发送方，未来可信运行时负责上游/下游路由。

### I-S04: 验证修订契约并交付

更新相关 schema、文档、skill、单元、集成和 CLI 测试，覆盖内部
迁移恢复、版本边界、并发前态、放弃禁令及 v2 公开输入。验证本仓库
旧数据的实际迁移前另行确认操作时点，不隐式执行。按仓库检查、
单独提交和普通非 force 同步流程交付，不自动发布 npm。

## Acceptance criteria

### I-AC01: 最终 v2 只暴露九种事件

schema 与 CLI 测试证实项目版本仍为 2，九种单词事件和原 payload
通过严格校验，旧点分 type 不成为其他项目的公开输入；完整消息
投影不伪造验收、清除目标或误认阻塞为完成。
`test/contract/schema-v2-interaction.test.js`、
`test/runtime/event-v2-interaction.test.js` 和
`test/unit/idea-events.test.js` 覆盖公开格式与投影；
`pnpm check` 已通过。

### I-AC02: 内部迁移等价且边界可恢复

本仓库的旧日志逐条映射后事实状态等价；空日志、放弃期间旧违规
事件、并发 primary、前缀篡改及事务中断均有测试。历史审计能
区分内部前后格式而不暴露 `schema/v3` 或 `version: 3`，迁移后
健康前缀禁止修订。
`test/runtime/migrate-internal-events.test.js` 覆盖计划摘要、逐条等价、
空日志、外部仓库拒绝、并发和事务恢复。经明确确认后，以 primary
`b2e53ba18ebc05d97b048bc1f7a4fe0118fe48c6` 的准确计划摘要
`d7d4f9c308c03c01122fc52f21b482c6c90965cc190e197877d8f51edb5c21bc`
执行内部入口，40 个 idea 日志转换成功。`check --worktree` 的
`eventHistory` 对所有转换均报告 `migration-final`，逐条核对旧事实与
新投影等价；没有直接编辑日志或迁移其他仓库。

### I-AC03: 本地消息不受 Git 故障锁死

测试离线、未提交和连续 `pong` 场景；旧长度/摘要上遇新 `ping`
时拒绝旧请求并要求重新观察。人类决定仍须准确 primary 和授权，
`abandon` 后只能 `resume`。
`test/runtime/event-v2-interaction.test.js` 和
`test/runtime/event-state.test.js` 覆盖本地前态与决策约束。

### I-AC04: 修订实现通过仓库验证

针对性测试、`pnpm check:commit`、`pnpm check`、Silvermoon
`check --worktree` 和 `check --staged` 通过；同步的提交从
刷新后的 primary 可达，没有自动发布或跨仓库旧格式迁移。
实现候选的针对性测试共 30 项通过；`pnpm check:commit`、
`pnpm check`、`pnpm pack:check`、`node bin/silvermoon.js check --worktree`
及 `node bin/silvermoon.js check --staged` 均已通过。迁移后的最终候选
仍须复验、提交并从刷新后的 primary 确认可达；未自动发布 npm。
