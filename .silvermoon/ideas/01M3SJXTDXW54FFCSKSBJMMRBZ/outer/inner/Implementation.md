# Implementation

## Steps

### I-S01: 实现 v3 单词事件与完整投影

扩展 `src/idea-events.js` 与 `schema/v3`，保持 v2 读取和原状态归约；
在 v3 用 `setAlias`、`setLanguage`、`approveIdeal`、
`acceptImplementation`、`acceptDeployment`、`abandon`、`resume`、
`ping`、`pong`。两种消息的 payload 仅含非空 `message`。完整状态
保留 `status`、连续 `sequence` 与有序消息投影；仅 `ping/pong`
更新球权，`pong` 只陈述阻塞而不清除先前目标。`abandon` 之后只允许
`resume`，其余事件各自按前态与业务规则校验，不要求严格交替。

### I-S02: 建立显式 v2 到 v3 的可恢复迁移

提供独立的只读计划与按准确摘要应用的迁移入口，不在普通命令中隐式
升级。逐条只转换七种旧事件的 `type`，保持序号、payload 和旧事实
投影；一次可恢复事务切换所有 idea 日志和项目配置。迁移前拒绝旧日志
中放弃至恢复期间夹杂其他事件，校验历史版本边界与并发 primary；
旧 Git 提交仍按 v2 解读，迁移后日志继续受 append-only 保护。
本步骤交付迁移能力，不直接对本仓库执行迁移。

### I-S03: 扩展本地事件 CLI 与导航边界

沿用 `event replay/append/revise/recover`，不新增并列的交互命令组。
`replay` 返回完整投影及日志长度/摘要；v3 `ping/pong` 追加绑定已
观察的准确本地字节前态，不要求 fetch、commit 或 primary；旧前态
冲突不得重新编号。保留 lifecycle 人类 gate 的准确 revision、primary
前提。无状态 CLI 不冒充发送者身份认证；未来可信运行时负责上游/下游
路由。合法的本地未提交交互尾部可以被交互路径消费，不能豁免无关
脏文件或常规 lifecycle 的同步要求。

### I-S04: 验证兼容性与仓库交付

用单元、集成、CLI 与迁移恢复场景证明 v2 回放兼容、v3 schema 与
历史边界、并发竞争、连续 `ping/pong`、阻塞投影及放弃禁令；更新
相关文档与 skill。运行仓库检查，按版本边界所需顺序提交并普通
同步候选；不自动发布 npm。

## Acceptance criteria

### I-AC01: 两版本的归约保持完整而无伪造决定

在测试中逐条回放 v2 及 v3 日志，断言七种旧事实的投影保持一致、
九种 v3 type 均有完整 schema；`ping/pong` 的不同序号消息按序保留，
`pong` 不代表完成、不清除目标，也不产生批准/验收。

### I-AC02: 迁移边界可验证且可恢复

对有效 v2 日志证明只改 type 且状态等价；对夹杂放弃期间事件、前缀
篡改、并发 primary 变化与事务中断分别证明拒绝或明确恢复。`check`
按历史版本审计迁移前后，禁止通过普通 `event revise` 绕过健康 primary
的 append-only 保护。

### I-AC03: 本地消息不受 Git 故障锁死

CLI 场景验证未提交交互消息的本地 replay/append，无新 `ping` 时连续
`pong` 可写；在旧长度/摘要上并发追加会冲突且不误清新目标。交互
无需网络，生命周期决定仍须准确 primary 与人类 gate，`abandon`
后除 `resume` 外所有事件被拒绝。

### I-AC04: 项目交付通过仓库检查

针对性测试、`pnpm check:commit`、`pnpm check` 和 Silvermoon
`check --worktree`、`check --staged` 通过；相关文档与 ledger 同步，
提交可从刷新后的 primary 到达，不需要 npm 发布。

## Verification

- `node --test test/runtime/migrate-v3.test.js test/runtime/event-v3.test.js`：
  通过（12 项），覆盖双版本迁移边界、恢复、并发前态及离线消息。
- `node --test test/contract/schema-v3.test.js test/unit/idea-events.test.js`：
  通过（8 项），覆盖九种事件 schema、投影和放弃禁令。
- `node --test test/runtime/event-state.test.js`：通过（14 项），验证
  v2 CLI 和历史回放不退化。
- `pnpm check:commit`：通过；`pnpm check`：通过（包含单元、契约、
  集成、端到端、打包和 skill 检查）。
- 本次交付只实现 v2→v3 显式迁移工具，没有对本仓库现行 v2 数据执行
  迁移，也没有发布 npm 包。
