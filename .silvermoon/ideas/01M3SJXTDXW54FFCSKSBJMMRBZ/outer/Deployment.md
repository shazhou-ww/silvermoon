# Deployment

## Steps

### D-S01: 固定已验收候选和验证边界

以 `acceptInner` 已记录的 implementation revision
`1398c421875560704eaa583935563558b1196e9f` 和源码提交
`14e9bdcb84a93bfa332e6c450a060c3f20e7e87d` 为候选。
先将本部署契约及 ledger 同步 primary 并重新观察稳定的 deployment
revision，再运行验证。不修改已验收内层世界，不重复执行内部迁移，
也不发布 npm；本项不证明真实 Agent session 的送达。
契约已同步至 primary 提交
`1d7e74fb03c2b8ee288079d94ea6d7cc5420c350`；同期部署 revision
为 `77a61838f556109dfe7b9e7486783595618c4184`。

### D-S02: 验证隔离消费与交互边界

运行 `node --test test/e2e/installed-package.test.js`，验证从本
checkout 打包并安装到隔离消费项目后的 CLI 行为。运行
`node --test test/runtime/event-v2-interaction.test.js
test/runtime/migrate-internal-events.test.js`，验证离线消息、旧前态拒绝、
严格事件校验和迁移恢复；这些夹具不冒充真实 Agent 运行。

### D-S03: 验证真实 primary 与提交证据

运行 `node bin/silvermoon.js check --remote --audience agent` 和
`pnpm check`，确认真实 primary 上的最终 v2 日志及历史可读。
在本文档记录执行环境、命令结果和同期 primary 提交并同步证据；
重新观察准确 deployment revision 后在该候选上复验，不以勾选
代替人类对准确 revision 的最终验收。

## Acceptance criteria

### D-AC01: 隔离消费与协议故障边界通过

D-S02 两项命令均退出 0；安装包测试报告 `PACK_SMOKE_OK`，
交互与迁移夹具无失败或跳过。以固定版本测试断言及实际结果
证明本地读写和恢复边界，不宣称真实 session 已集成。
在 macOS、Node `v26.7.0`、pnpm `11.22.0` 上执行 D-S02：
安装包测试 1/1 通过、0 跳过并报告 `PACK_SMOKE_OK`；
交互与迁移测试 14/14 通过、0 跳过。

### D-AC02: 真实 primary 保持可验证

D-S03 的 remote check 通过并报告有效事件历史，`pnpm check`
通过；迁移日志保持九种最终 v2 类型，旧提交可回放且无自动
版本升级。以检查输出及同步提交证明。
在上述提交执行 `node bin/silvermoon.js check --remote --audience agent`
报告目标 `remote`、结果通过；`pnpm check` 退出 0，
`pack:check`、integration、e2e 和 quick 各层均通过。

### D-AC03: 证据同步且发布边界不变

部署契约记录候选、环境及结果；仅 Deployment 和 ledger 因部署
证据改变，已验收 implementation revision 不变。同步后的准确
deployment revision 经再次验证且提交从刷新后的 primary 可达；
不自动写入 `acceptOuter`，不发布 npm。
已验收主体世界提交仍为 `14e9bdcb84a93bfa332e6c450a060c3f20e7e87d`；
本轮未改主体世界或生产代码。证据提交
`baf3079e99da36aebc20bff80dba960a0c9e06d5` 已同步 primary，
在其部署 revision `b15d1ef830652b55317dd70c59075faedac1e439`
再次执行 D-S02、D-S03 的全部命令，均通过且无跳过。
同步后的最终 revision 仍须重新验证及明确人工验收。
