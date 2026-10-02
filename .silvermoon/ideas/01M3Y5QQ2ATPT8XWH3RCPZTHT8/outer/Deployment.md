# Deployment

## Steps

### D-S01: 固定源码仓交付边界

本次现实世界交付仅指 Silvermoon 源码仓 configured primary 上的可用状态，
不是 npm 发布或外部项目 rollout，不实现 daemon/治理生命周期。
保护原 daemon 讨论 worktree 的未提交工作，不切换或修改其他 worktree。
仅更新本 Outer World 与匹配 ledger，不修改已接受的 Inner World 或 Ideal。

已接受 implementationRevision 为 `879b991312941446f12c296cce16f6da95f9938e`，
acceptInner 独立 commit 为 `84d6e3d6eb95ab4f927c2aab9214e71e783d5d80`。
先将本部署契约通过普通 Git 同步到 primary，重观准确 deploymentRevision，
再执行下面的只读验证。任何 primary、受验代码或接受 revision 变化均重新判断，
不重放旧决定，不自动记录 acceptOuter。

### D-S02: 验证 primary 的实际分段运行状态

使用本专用 checkout 的 `node bin/silvermoon.js`，不使用发布包或别的 checkout。
从 primary 的不可变 Git snapshot 验证全部现存 idea 均只有规范 `events/`，
无 current 单文件/双 authority；V2/version 不变，全部流可完整解析与归约。
核对本 idea 的 accepted implementation、全流 sequence 与完整 folder digest。

运行 `check --remote`、`event replay` 与带当前准确 cursor 的只读 replay。
cursor 无新增时必须返回空 events；完整 replay 必须保持准确接受事实。
内部迁移入口只运行 read-only plan，必须返回 `already-segmented`、
`written: false`，不得再次改写或追加任何事件。
检查前后 Git status、真实 index 和事件 authority 不应变化。

### D-S03: 核对跨平台交付证据并完成协作交接

外部 CI [37021170347](https://github.com/shazhou-ww/silvermoon/actions/runs/37021170347)
固定代码 commit 为 `96f84c0cb60e39cda724a595a56eec431226f54f`。
确认该运行及全部 jobs 为 success，Windows/macOS/Ubuntu × Node 22/24
native source 与实际 CLI 成本验证均执行，而非跳过 Windows 或降低阈值。
比较 primary 的代码、schema、测试、skill、文档、包配置与该 CI commit 的
实际 Git content OID；Outer World/ledger 和明确状态事实变化不能冒充代码变化。

将只读断言结果与来源记录到本 Outer World 的 `Verification.json`，
完成后再次同步、重观并核对受验内容未变，再提供准确 revision 的部署验收索引。
通知原 daemon 讨论 session 可用 primary、已接受实施和仍需显式 acceptOuter 的边界；
不修改该 session 的讨论稿，不替它接受或继续实现 daemon idea。

## Acceptance criteria

### D-AC01: primary 可用且接受事实准确

专用 checkout 的已提交候选经普通非强制 push 到 configured primary，
acceptInner commit 可达；`whats-next` 状态为 deploying，accepted implementation
仍准确匹配当前 inner tree，Ideal 仍为 `d98b9ac7a24917cd82ef82242ded57b435870188`。
`check --remote --audience agent` 退出 0；没有擅自记录 acceptOuter 或发布 npm。
以刷新后的 primary、Git ancestry、CLI report 和事件归约断言证明。

### D-AC02: 实际迁移状态及只读查询一致

primary 的全部 41 个 idea 使用规范分段 V2，完整流格式与归约有效；
本 idea 的事件为 setAlias、acceptIdeal、acceptInner，sequence 3，
包含准确已接受 implementation revision，且无 deployment acceptance。
逻辑长度、folder digest 与实际 Git segment bytes 一致；
同一 cursor 的增量查询返回空数组，不创建新 session 或业务事实。
内部工具 read-only 返回 already-segmented，验证前后 index/status/事件内容不变。
以不可变 snapshot 与真实项目 CLI 的精确断言证明，而非仅引用 fixture。

### D-AC03: 受验交付内容与外部证据相符

上述 CI 的全部 jobs 成功，当前 primary 的受验代码和包内容相关树与
准确 CI commit 一致；Windows 的 10001/100001 事件 interaction/metadata/cursor
读取成本保留每项 <10000 字节、无 sealed body 的原断言。
已完成 scope-limited 协作通知，原 daemon 未提交工作未被操作。
通过外部 CI API、Git object 比较、`Verification.json` 与交接结果证明。
世界契约和 ledger 的完成只记录 Agent 执行，不代替准确 deploymentRevision
的人工接受。
