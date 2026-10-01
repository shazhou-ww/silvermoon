# Ledger

## Ideal World preparation

用户要求在 Ideal World 补全关键技术设计，技术方案独立成文并由 Idea.md
引用，重点审阅事件类型，同时记录其他重要技术选择。

- 配套设计：[Technical-design.md](./outer/inner/ideal/Technical-design.md)，
  由 [Idea.md](./outer/inner/ideal/Idea.md) 引用并共同计入 ideal revision。
- 用户要求以 TypeScript 具体定义事件和 reducer，已补充
  [Event-state-model.ts](./outer/inner/ideal/Event-state-model.ts)，仅为理想
  设计模型，当前包含七类事件、非空转换、自增序检查与旧五态推演。
- 按用户审阅反馈，事件类型改为显式 discriminated union，每个分支并列
  展示 type 和 payload；移除 EventPayloads 映射间接层，归约行为不变。
- 已明确的语义：原 status.yaml 状态推演不变；只读查询使用实际世界
  revision，不自动追加观察，也不以观察未归档为由新增导航门槛。
- 用户后续明确：持久 event 必须完整、确定性改变旧 status 事实投影；
  重复输入不追加无操作事件。已撤销纯观察 E-04，并收紧元数据变更。
- 用户明确 append-only 只保护已提交并合入 main 的事件；本地未集成候选
  可同步后重审、去重和重新编号。并发不自动合并，采用自增序与乐观锁方向。
- 用户补充 check 规则：仅 base 完整归约为 ok: true 时强制 append-only；
  base 明确归约失败时允许改旧事件修复，完整候选须归约成功。修复成功后
  恢复前缀保护，旧失败不能永久阻塞；基线不可用不冒充归约失败。
- 用户进一步要求业务模型极简：删除 created，metadata 拆为 alias/language
  更新，删除审计字段与 repo commit 依赖。明确选择迁移用普通状态变更事件，
  删除 imported；归约顺序不冒充历史顺序，迁移与写入校验留在工具层。
- 当前方案取消 Envelope、eventId、逐行版本、前序 hash 及来源索引。
  日志摘要仍用于外层乐观锁请求，不存入事件。身份来自目录，空日志合法。
- 用户确认不引入内容不变时独立撤回批准/验收的能力，已删除
  decision.retracted、DecisionField、expectedRevision 及对应归约分支。
  实际业务变化修改对应世界内容，让 revision 自然级联失效并重新审阅。
- 待审阅设计：七种有效状态迭代、准确决定与更正、受控本地后缀修订、
  primary 基线及集成主线校验、whats-next/skill 恢复指引、schema 切换与
  一次性迁移；详见 T-01 至 T-10。旧 DAG/所有父日志并集方案已撤销。
- 前述设计讨论未单独作为批准。用户随后明确要求“记录下来后，我 approve
  idea，可以推进实现”，批准已绑定包含修复规则的准确 ideal revision
  `519ebd3b273c99f8c4f1d40b8effb163df1763e2`。
  状态事实独立提交 `7c64dc483e0ed12969c934aa4573f615e9e104de` 已同步 primary，
  重新观察进入 implementing。没有实施验收或部署验收。

## Implementation

### Implementation steps

- [x] **I-S01:** 实现最小事件核心与严格 schema
- [x] **I-S02:** 接入 v2 项目读取与创建
- [x] **I-S03:** 实现基线检查与修复例外
- [x] **I-S04:** 接入受控追加、修订和恢复指引
- [x] **I-S05:** 实现独立的一次性迁移
- [x] **I-S06:** 完成文档、skill、集成与交付证明

### Implementation acceptance criteria

- [x] **I-AC01:** 七种事件完整且克制
- [x] **I-AC02:** 旧事实与五态行为保持
- [x] **I-AC03:** 检查准确区分追加、修复和不可用
- [x] **I-AC04:** 并发写入和修订安全
- [x] **I-AC05:** 迁移显式、完整、可恢复
- [x] **I-AC06:** 全部入口与发布级检查通过

### 实现与证明索引

| 标准 | 生产交付与可复现证据 |
| --- | --- |
| I-AC01 | [事件核心](../../../src/idea-events.js)、[七类 schema](../../../schema/v2/idea-event.schema.json)；[纯单元测试](../../../test/unit/idea-events.test.js) 与 [schema 契约测试](../../../test/contract/schema-v2.test.js) 覆盖七类、严格字节解析、非法字段/序号、无操作、空日志和不可变输入。 |
| I-AC02 | 同一纯单元测试逐项比较 216 种 v1 字段组合；[运行时测试](../../../test/runtime/event-state.test.js) 比较迁移前后 inventory，并证明修改/准确还原世界时的五态变化与日志只读。原有级联失效测试保持通过。 |
| I-AC03 | [历史检查](../../../src/event-history.js) 及运行时测试覆盖四类目标、健康前缀、坏 base 修复、修复后恢复保护、跨 idea 隔离、格式错误、缺 tracking ref、shallow 缺父、迁移边界、正常 v1 历史与禁止降级。 |
| I-AC04 | [受控命令](../../../src/event-command.js)、[事务](../../../src/state-transaction.js)；运行时测试用两个 CLI 进程争用同一前态，覆盖旧摘要/重复请求/无操作、准确人工门槛、本地 commit 修订后的 first-parent 合并、事件进程中断、primary 移动后拒绝旧恢复及准确回滚。 |
| I-AC05 | [独立入口](../../../bin/migrate-v1-to-v2.js)、[迁移实现](../../../src/migrate-events.js)；运行时测试在计划准备、候选落盘、状态删除、配置切换和完成后注入进程退出，逐项恢复/回滚；未知修改保持原样，重复运行不追加。 |
| I-AC06 | [安装包 E2E](../../../test/e2e/installed-package.test.js) 从真实 tarball 运行独立迁移、check、event replay/append；[命令与恢复文档](../../../skills/silvermoon/references/events.md) 和 canonical/registered skill 同步，包内容检查包含新入口与 schema。 |

本机 Windows、Node `v24.12.0` 上已执行：

- `pnpm check:sanity`：通过，包含新 v2 schema 与纯事件测试。
- `node --test test/runtime/event-state.test.js` 的全部场景在最终
  `pnpm check` 的 unit/runtime 套件中通过。
- `node --test test/e2e/installed-package.test.js`：通过。
- `pnpm sync:skills`、`pnpm check:skills:local`：通过。
- `node bin/silvermoon.js check --worktree --audience agent`、
  `node bin/silvermoon.js check --staged --audience agent`：通过。
- `pnpm check:commit`：通过；本次实施源码的 index 与 worktree 对齐，
  未将 metadata check 当作源码测试结果。
- `pnpm check`：通过全部 release checks，包括 Markdown、unit/runtime、
  contract、integration、包内容、安装包 E2E 和外部 skill discovery。
  原有需要 Windows symlink 特权的场景按原测试规则跳过，不将其写成通过。

恢复边界已写入 Implementation 和操作文档：文件 fsync、同目录原子替换；
Windows 不宣称目录 fsync 或硬件断电保证。恢复进程自身被终止后保留其
互斥文件，需停下所有恢复参与者并核验 PID/原计划后再明确清理该互斥文件，
不按年龄抢锁、不自动删除未知文件。真正的数据写入中断由准确计划恢复。

这些勾选和证明仅记录 Agent 实施工作，不构成人工验收。用户随后明确验收
implementation revision `0dbc1f0cc26965ce613fbf28d8dad624f3cdc767`；
独立状态提交 `3280fa037ce8248a9b8820e4198f3005ed007b74` 已同步 primary，
重新观察进入 deploying。已批准的 ideal revision 保持不变；仓库仍为 v1，
未迁移真实 idea，未创建 PR、发布 npm 或记录 deployment acceptance。

## Deployment

### Deployment steps

- [x] **D-S01:** 固定部署候选与隔离边界
- [x] **D-S02:** 验证可安装交付与独立迁移
- [x] **D-S03:** 复验状态、恢复与历史规则并交付证据
- [x] **D-S04:** 显式迁移本仓库全部 idea 并集成边界

### Deployment acceptance criteria

- [x] **D-AC01:** 安装包在隔离消费环境完成升级和受控写入
- [x] **D-AC02:** 故障与并发边界可复现
- [x] **D-AC03:** 证据同步且发布边界保持
- [x] **D-AC04:** 全量事实无损迁移且真实 primary 采用 v2

用户在部署审阅时明确选择“是，更新部署契约并执行本仓库迁移”。
这是本仓库全量迁移与 schema v2 切换的授权，不是部署验收。
部署契约新增 D-S04 / D-AC04；前次隔离验证保留为历史证据，
本次按新的准确部署 revision 重新验证并补充真实 primary 迁移结果。

### 首次隔离部署执行证据

2026-10-01，在本独立 worktree 的 Windows x64、Node `v24.12.0`
环境执行。部署契约先随 commit
`a7fbf9cdcba42b5c544a9e0455f75aae246b9a62` 同步真实 primary，
随后 `whats-next event-state-model --audience agent` 报告 deploying，
准确 deployment revision 为 `d8c62e0e136baa46a0f15d2fcbe4ef721639d5a0`。
以下执行均针对该干净 commit，先固定契约再执行，没有事后改写验收标准。

| 标准 | 实际命令与结果 | 证明入口 |
| --- | --- | --- |
| D-AC01 | `node --test test/e2e/installed-package.test.js`：退出 0；1 个套件文件通过，0 失败、0 跳过，耗时 40766.8144 ms；输出 `PACK_SMOKE_OK name=silvermoon version=0.3.0`。 | [安装包 E2E](../../../test/e2e/installed-package.test.js) 从本 checkout 打包安装，在 event-consumer 中执行计划、apply、check、提交并推送隔离 primary、replay、append；断言回执为 `candidate-written` 及日志包含新 alias。 |
| D-AC02 | `node --test test/runtime/event-state.test.js`：退出 0；14 个场景全部通过，0 失败、0 跳过，耗时 48515.08 ms。 | [运行时场景](../../../test/runtime/event-state.test.js) 使用独立 Git/文件系统夹具和 CLI 子进程，覆盖下列分组。 |
| D-AC03 | `node bin/silvermoon.js check --remote --audience agent`：退出 0；目标 `remote a7fbf9cdcba42b5c544a9e0455f75aae246b9a62`，结果通过。 | [部署契约](./outer/Deployment.md) 与本 ledger；证据提交只更新 ledger，保持已验证 deployment revision。 |

运行时 14 个场景的通过范围：

- 迁移前后 inventory 相等、四类 check 目标及重复迁移；
  精确 CAS、重试、无操作不写入；准确世界、人工确认和生命周期次序。
- 健康前缀不可改写、失败基线修复并恢复保护；v2 空日志创建及双权威拒绝；
  迁移各阶段中断恢复与准确回滚。
- 两个 CLI 进程争用同一位置；本地候选修订与 first-parent 安全集成；
  其他 idea 失败不解锁健康前缀、格式失败不授予修复许可。
- 世界观察不写日志、primary 移动拒绝旧写入；缺 tracking ref、shallow
  缺父失败关闭且旧 v1 历史可读；事件写入中断恢复及 primary 移动后的回滚。
- 迁移恢复保留未知字节；逐文件应用前再次检查来源，保留预检后的并发修改。

安装包测试的临时消费仓库、bare primary、tarball 由其 `finally` 清理；
运行时夹具由各场景 `t.after` 清理。原始输出保存在本 session 的
`event-deploy-installed.log` 与 `event-deploy-runtime.log`，
长期审阅依赖本页结果摘录及固定候选的可复现测试，不依赖临时目录仍存在。
本次未创建新的线上服务，也未使用 daemon 或真实 Agent。

边界复核：从实现源码 commit `211fc313d741ff77500f3634d07efac291bf02de`
到部署候选，仅变更本 idea 的 Deployment、ledger 和独立实施验收事实。
Git 读取的 inner tree 仍为 `0dbc1f0cc26965ce613fbf28d8dad624f3cdc767`；
配置仍为 schema `1`，包仍为 `0.3.0`，所有依赖区均无 silvermoon 自依赖。
没有修改生产交付、迁移真实 idea、发布 npm 或写入 deployment acceptance。
Windows 进程恢复及人工处理恢复锁的限制仍按实施契约保留。

以上勾选是部署工作与证明，不是用户验收；证据随本次 ledger 提交同步
primary 并重新观察准确 revision 后，才请求部署验收。

### 本仓库实际迁移执行证据

用户明确授权后，修订部署契约先随
`6e638f5514277f52bfca9dd28d2529b5163da380` 同步 primary；
随后观察准确 deployment revision
`b1ec4ccd5ff6c0e19342a089809b8c5041d60bda`，状态仍为 deploying。
迁移固定使用该干净 source commit，包含并发加入 primary 的
`dependency-update-evaluation` idea，没有丢弃其他 session 的工作。

2026-10-01 在同一 Windows x64 / Node `v24.12.0` 环境执行：

| 标准 | 命令或核对 | 实际结果 |
| --- | --- | --- |
| D-AC01 / D-AC02 | `node --test test/e2e/installed-package.test.js test/runtime/event-state.test.js` | 退出 0；安装包 E2E 与 14 个运行时场景共 15 项通过，0 失败、0 跳过，50350.654 ms。 |
| D-AC04 | `node bin/migrate-v1-to-v2.js` | 只读计划包含下列 40 个 idea；未写入。 |
| D-AC04 | `node bin/migrate-v1-to-v2.js --apply --expected-digest 9c33e812f444ee149aa09619a3d3c006731432106b3cabffc30aa05c187cd7b1` | 退出 0，`migrated`、`written: true`；生成 40 个日志、142 条事件，移除 40 个 status，项目切换为 v2。 |
| D-AC04 | 再次运行 `node bin/migrate-v1-to-v2.js` | 退出 0，`already-v2`、`written: false`；全部日志及 config 字节不变，无 transaction、recovery、pending 或 prepared 残留。 |
| D-AC04 | `node bin/silvermoon.js list-ideas --all --json` 的前后报告；逐一读取来源 commit 的 status 并与日志 replay 比较 | 40 份事实逐字段完全相等；inventory 完全相等：5 preparing、1 deploying、34 completed；所有世界和原 ledger 字节不变。 |
| D-AC03 / D-AC04 | `node bin/silvermoon.js check --worktree --audience agent` 与 `check --staged --audience agent` | 均退出 0，准确 v1 基线下的完整迁移候选通过。 |
| D-AC04 | `node bin/silvermoon.js check --commit f2eb8bbf1134a295a71bd07eaa3b4c81dcbd3ba5 --json` | 退出 0；独立迁移 commit 通过，随后以仍未变化的 source primary 普通 push。 |
| D-AC03 / D-AC04 | `node bin/silvermoon.js check --remote --json` | 退出 0，固定 remote `f2eb8bbf1134a295a71bd07eaa3b4c81dcbd3ba5`，历史包含 40 个 migration 边界。使用 JSON 为读取完整四投影证据。 |
| D-AC03 / D-AC04 | `pnpm check`、`pnpm check:commit` | 均退出 0；本仓库 v2 状态下 release checks 全部通过，`CHECK_TOTAL 56774ms`。原有 Windows symlink 特权跳过仍按既有规则，不冒充通过。 |

来源：[v1 来源树](https://github.com/shazhou-ww/silvermoon/tree/6e638f5514277f52bfca9dd28d2529b5163da380/.silvermoon/ideas)。
结果：[独立迁移提交及完整差异](https://github.com/shazhou-ww/silvermoon/commit/f2eb8bbf1134a295a71bd07eaa3b4c81dcbd3ba5)；
该提交仅包含 config 和 40 组 status/events 替换，已确认可达刷新后的 primary。
迁移后 `whats-next event-state-model --audience agent` 仍报告 deploying，
同一 deployment revision，并改为指引受控 `deployment.accepted` 事件。
inner tree 仍为 `0dbc1f0cc26965ce613fbf28d8dad624f3cdc767`。

原始执行输出与前后 inventory 保存在本 session 的
`event-real-deploy-scenarios.log`、`event-source-v2-release-check.log`、
`event-migration-before.json`、`event-migration-after.json`、
`event-source-migration-verified.json` 和 `event-migration-remote-report.json`。
长期可复核证据是上述固定来源、结果 commit 和本页摘录。

用户指出 `01M3939JHGGG1BWYXV2WXV3WPW` 没有 alias 事件后，核对其
status 全部历史：创建时只有 id，之后仅追加三个决定，从未设置 alias。
迁移前 36 个 idea 有 alias，36 条 `alias.updated` 均保留；另外 4 个
本来无 alias，不从标题补造元数据。此次迁移没有新增人类决定。

完整迁移 idea 清单：

```text
01M36QGPNTXEPP61DA4KP4AVG0
01M38Y3FT4P3AEZNGV9R70ZBXQ
01M3939JHGGG1BWYXV2WXV3WPW
01M3954Y3F13T1CQT820SP73RN
01M396DEC3R5B6M9KS3M2XSPTG
01M397A1ME5Z7591N4RE4XMB6M
01M397R8V3X3YNKVQ2E488N5BS
01M39AGSWT0QN0WMGRZ4SG7NT0
01M39BAGAKQTBKNWTVCMPWSN2E
01M39CAEMMECFW02NX9Z6CTFYG
01M3A014VQYW5NGGZBR1WNNEKZ
01M3A1157K2Q2PGEQ6H3V9X6ZV
01M3A1Y9BT5T6P6QTD3P9AXNT8
01M3AT95KSJH5JWCYXXK8RZF5W
01M3KFVY57Z43T15HS0TBFZG69
01M3KG00VJ8AV81FG5CZSK4A5H
01M3KN5BSDCV0S1D2Y2TV2JQPY
01M3KZ4S2G05R6VNMY12CD25AQ
01M3M7JR0H0QKMFJCR927NJSVZ
01M3M9VG7YA6BMAMHX09SBA308
01M3NC031WWGB85Y1QYS6PQBEW
01M3NCEGB770WDDBDXVEHDRJHV
01M3ND2G20ED0DRDS94VK1GY32
01M3NDKZT9RTHDEN0JS053F1YB
01M3NETHZ89CBHDJ1QSBGAJT4W
01M3NM5KSVV303Z8T9P63Q2JZ8
01M3P0ZVEK0HRE4RYNE3YS1SFJ
01M3P6R99PBKNYCH3K1WBAT6YT
01M3P74HC0NMFGGWAG9HX53ZR1
01M3PESG74Y4B77DXJ46SYWB9T
01M3PNPS4G9QBAQVJG0SBY8M1R
01M3PW06ZTSWFN6CBRMX4JJABV
01M3R5DJYGVFQYWA3WW61B6DEF
01M3R65W3C3F3HGQFW12H92SV0
01M3RD0HQRYNAFDT7EC6JJZGAN
01M3SJ90WVJB56Z1PP72BPAHFZ
01M3SJTKFRQ19DP0RPPJACKGMC
01M3SJXTDXW54FFCSKSBJMMRBZ
01M3SK3CGZF47A36D2GWN8BFPC
01M3TRRV7K14MMVDPND0J5ANW4
```

本次升级只改持久状态表示与来源格式，生产代码和已验收世界不变，
未访问主 checkout、未发布 npm。后续决定必须经项目 CLI 写入事件，
不能继续编辑旧 status，也不能降级 config。部署验收仍等待用户明确决定。
