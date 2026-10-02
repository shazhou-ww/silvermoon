# Implementation

## Steps

### I-S01: 收敛存储与提交协议

用户已明确选择每段固定上限为 **1000 条事件**；1024 不再是实施参数。
满段封存，尾段追加，sequence 与逻辑 session 不因切文件改变。
此参数在本实施契约记录，不改写已批准的 Ideal revision。

用户随后明确要求参考 world accepted digest 的算法，且只计算 events folder，
不是 repository HEAD、commit 或完整 repository tree；并授权 Agent 收敛其余技术细节。
本实施采用以下确定方案，不改写已批准的 Ideal：

- 流目录为 idea 根的 `events/`；文件名是从 1 开始的 16 位补零 ordinal 加 `.jsonl`。
  空流持有空的第一段；刚满段不预建空尾段。sequence 仍为全流连续的安全整数。
- 对原始段字节使用 Git blob 编码，再对有序规范文件名、固定 mode `100644` 与
  blob OID 使用 Git tree 编码。算法跟随仓库 object format，和 world revision 一样
  支持 SHA-1/SHA-256；摘要长度随之为 40/64，不改变任何 world 的 accepted revision。
- 单事件最多 1048576 字节，包含 LF，按 UTF-8 字节计而非字符数计；
  1000 条段上限与单记录上限共同约束资源，不截断超限消息。
- `checkpoint.json`、`cursor.json`、`lock` 和 `.pending`/`.prepared` 文件不纳入 digest。
  不信任未经来源验证的持久化状态 checkpoint；未知名称、不规则对象与非规范段序显式拒绝。
  目前 cursor 使用逻辑字节长度；对旧前态重试计算准确前缀的 folder digest。
- 幂等身份沿用 idea 身份、准确前态长度/digest 与该前缀后的准确规范记录的组合。
  相同 HEAD 单独不构成幂等证据。不增加事件 envelope 或传输 request ID：
  相同前态下完全相同的规范请求表示同一逻辑提交；第二次独立提交应先重新观察，
  不能由接收方自动刷新前态重试。原有 sequence 与 payload 保持不变。
- 项目级 recoverable transaction 串行化协作 writer；单次正常追加只改尾段或创建一段。
  多文件 revise/迁移期间，项目命令按 transaction barrier 阻挡；不承诺裸文件系统
  观察者忽略该屏障时有多文件原子快照。成功回执在完整候选复核和 lock 释放后返回。
  各文件先 fsync 再同目录 rename，POSIX 同步目录；Windows 不承诺目录 fsync，
  进程中断恢复不等于已测试硬件掉电。
- 分段前的单文件 V2 仅保留源仓内部转换和历史读取边界；外部 V2 当前 layout
  不提供该兼容。V1 到 V2 的已发布独立迁移能力保留，并直接生成分段 V2 及 binary 属性。

### I-S02: 建立共享分段流模型

实现 V2 分段存储的共享规范及验证，统一确定性段序、1000 条切段、完整流 HEAD、
增量聚合与可验证来源绑定；派生缓存排除在规范 digest 之外。
保留 V1 与既有事件 schema 语义，schema version 仍为 2。
以实际读取量和复杂度证明增量，不以 API 名称替代性能证据。

### I-S03: 统一读写与历史边界

接入 layout、创建脚手架、状态观察、回放、event append/revise/recover、
primary Git snapshot 与历史比较，以及相关公开/内部类型和 runtime 追加边界。
复用共享流模型，禁止不同消费者自行定义段排序或 HEAD。
现有原始字节 digest 不能冒充 folder digest；提交前态与请求身份须分开处理。

### I-S04: 保全事务与恢复

扩展准确来源保护与 recoverable transaction，使尾段追加、满段封存、切段及聚合发布
有明确提交点和恢复路径。保留未知工作、外部编辑和并发写入，stale 显式拒绝并交还发送方。
同一请求的重复提交须核对原前态之后的准确记录，不自动刷新 HEAD、重编号或重试旧意图。
进程中断恢复与硬件掉电保证分开说明，采用既有事务能力时明确必要改动与平台边界。

### I-S05: 提供仓库内部迁移

新增源仓旧 V2 到分段 V2 的内部一次性脚本及其计划、准确来源校验、应用和恢复路径。
保留全部事件顺序、payload、sequence、事实与决策，验证历史边界及迁移前后状态等价。
不新增对外迁移 CLI，不作外部旧 V2 兼容承诺，不意外打包内部迁移能力。
保留既有 V1 到 V2 与无关已发布版本迁移能力；来源或 primary 变化必须阻挡而非假成功。
本步骤不自动授权在外部项目执行迁移。

### I-S06: 验证全相关表面

补齐单元、contract、真实文件系统/Git、runtime、并发、幂等、崩溃恢复和迁移测试；
覆盖 999/1000/1001 事件以及连续多段、空流、跨日和损坏历史。
同步文档、canonical skill 与注册副本，验证类型、包内容和 CLI 结果一致。

### I-S07: 形成可审阅实施候选

按仓库要求运行 sanity、定向检查、release-grade 与提交前检查，
记录准确命令、结果、读取成本和平台保证于本实施契约或同世界证据文件。
仅勾选实际完成且证明仍有效的 ledger 项；正常提交与非强制同步前重观并发 primary。
同步候选并重观准确 implementationRevision 后请求 acceptInner；
本次 ideal 批准不等于 implementation acceptance。

## Acceptance criteria

### I-AC01: 分段确定且逻辑连续

空流、999/1000/1001、连续多段、跨日与重启得到相同有序事件和归约状态。
每段最多 1000 条，正常追加不重写封存段，sequence 不归零。
以真实存储边界测试和写入路径断言证明。

已验证：0/1/999/1000/1001/2000/2001 的唯一表示、反序输入规范排序、
1000→1001→1002 的真实 CLI 追加与全流 sequence、封存段原始字节和 mtime 不变。

### I-AC02: 完整流 HEAD 与可验证增量

相同规范内容产生相同 HEAD；任意历史事件或段的删除、修改、插入或交换均可被检测。
仅 sequence/尾段相同不能通过前态校验；锁、temp、checkpoint、权限和 mtime
不改变规范摘要。以独立完整验证、增量结果对照和篡改测试证明。
以实际读取范围与随历史增长的成本测量，证明正常追加与重复读取不总是全量扫描。

已验证：在 SHA-1 与 SHA-256 的真实 Git 仓库，规范 digest 与 `tree:events`
子目录 OID 相等且不等于整个 repository tree OID。不可变 Git snapshot 的
HEAD-only 路径不调用段正文读取；其对象表是内容来源，不信任 OS 目录元数据。
生产追加规划复用已验证段，仅生成变化段；缓存复制来源和记录，修改 Buffer 不会伪命中。

通过 `node --test test/unit/event-stream.test.js test/integration/event-stream-digest.test.js`
断言实际 hash 调用字节，而非计时代理。合成 SHA-1 满段流的增量追加测量如下：

| 已有事件 | 已有正文字节 | 新 blob hash 字节 | tree table hash 字节 |
| --- | --- | --- | --- |
| 1000 | 58786 | 61 | 100 |
| 10000 | 607788 | 63 | 550 |
| 100000 | 6277790 | 65 | 5050 |

平铺 Git tree table 的聚合仍为 O(段数)，但不重读/重哈希封存段正文。
完整 replay 输出与归约、来源首次验证、历史检查和外部编辑完整性复核仍读取历史，
不能把整个 stateless CLI 或冷启动宣称为常数时间。上述证明覆盖 HEAD 增量聚合，
不把未验证的 checkpoint 当作全量归约结果的替代品。

在 `7cfd70a` 候选时尚未满足：生产 `event append` 每次仍建立完整 worktree snapshot、
读取并归约完整逻辑流，且提交前后 live 完整性复核仍扫描历史。
因此 O-02 的正常追加与重复读取成本要求尚不能据上述核心 hash 测量判定通过；
I-S02 与 I-AC02 保持未完成，不能请求 acceptInner。后续必须在保持外部编辑检测、
准确前态和可恢复事务的前提下接通有来源证明的增量读取，并增加生产路径读取量测试。

用户已明确允许新增 cursor 增量查询，同时保留完整 replay。cursor 是消费者已经
成功处理的准确前缀 `{ length, digest }`，不是 session、checkpoint 状态或授权。
新增 `event replay <ULID> --after-length <bytes> --after-digest <oid>` 和
runtime `readSince`，只返回准确前缀之后的事件；未变返回空数组，stale 明确拒绝。
`delta-observed` 不提供完整 reduction，也不声称整个历史有效；不得用于绕过追加
的归约验证。此查询避免加载已封存前缀的 Git blob 正文，但尚未证明 snapshot
获取和生产追加的端到端成本，不能据此勾选 I-AC02。

cursor 查询候选验证：

- `node --test test/runtime/cursor-events.test.js test/runtime/event-state.test.js test/integration/project-runtime.test.js`：
  21 项通过。包括跨段增量、无变化、段内 cursor、事件字节边界、空流、
  历史篡改 stale、CLI 参数拒绝、真实子进程 runtime 和既有 metadata/human gate。
- 生产查询的 Git blob 命令观察确认不读取已封存前缀正文；此证据不包括
  `git add` 建立 worktree snapshot 时的文件读取，不能冒充总 I/O 测量。
- `pnpm check:sanity`：121 项通过。
- `pnpm sync:skills`、`pnpm check:skills:local`：通过。
- `pnpm check`：通过；173 项 unit/runtime、35 项 contract、141 项 integration、
  安装包 E2E、包内容、Markdown 与 skill 均通过。

后续已接通 canonical-ULID interaction append 与 cursor query 的 POSIX 增量路径：

- 仅这两个高频路径复用真实 index 的私有副本，不修改真实 index；其他 snapshot
  消费者仍保持原先从 HEAD 构建和完整验证的行为。清除 assume-unchanged/
  skip-worktree，不使用 fsmonitor 或弱化的 stat 设置。对 index 记录与实际
  ctime/mtime 纳秒做精确复核，发生变化强制重新读取；构建之后复核来源，
  并发变化显式拒绝。复制时保留 index 时间，不能绕过 Git 的 racy-entry 检查。
- 不把 stat 值当作 folder digest；HEAD 仍是完整规范内容的 Git tree OID。
  粗粒度时间条目和 Windows 回退到内容复核，不宣称该平台已获得同样读取成本。
- runtime 对 sealed-prefix 的纯归约摘要写入 worktree-specific Git-private
  `silvermoon-event-cache/`；摘要绑定 idea、准确 prefix Git digest 与相关 runtime
  源码 identity，由本地 0600 key 做 HMAC-SHA-256 认证。目录和文件必须是
  regular/private，不接受 symlink、无认证、错误来源或超大缓存。
  key 原子发布，摘要先写私有临时文件再 rename；不提交 key/摘要，也不记录消息。
  它们是可丢弃派生验证结果，不是新的事实、批准或独立状态 authority。
  不承诺对能同时替换 runtime/key 的本机用户提供安全边界。
- 首次验证或 prefix/runtime 变化仍从规范事件重建；warm append 读取最长
  已认证 sealed-prefix summary 与尾段。保留现有准确 prefix/record 重试；
  不同请求同一前态拒绝，writer 不自动刷新 HEAD 或重试旧意图。
  事务前后验证完整 folder HEAD，恢复仍按原完整候选验证路径处理。
- 真实子进程 CLI 测试分别使用 10001 与 100001 条事件（607851 与 6277853
  历史字节）。warm append 的 snapshot content-filter 实际输入和 runtime
  segment/Git-blob 实际读取各自均小于 **10000 字节**，且未读取任何封存段正文；
  cursor query 同样只读尾段。测量包含事务 owned segment 的精确字节复核，
  不是仅比较库内 hash 调用。总 metadata/table 工作仍为 O(文件/段数)，
  不宣称完整 CLI 为常数时间，也不把首次验证或完整 replay 计入 warm 路径。

上述改善不等于全部 I-AC02 已完成：alias interaction 仍需完整 alias/layout
解析，metadata/human-gate writes、审计和恢复仍完整验证，Windows snapshot
仍全量读取。这些剩余表面继续作为工程工作，不记录 blocked 或 acceptInner。

本增量候选的验证（2026-10-02）：

- `node --test test/integration/git.test.js test/integration/incremental-append.test.js test/runtime/segmented-events.test.js test/runtime/cursor-events.test.js test/integration/project-runtime.test.js`：
  22 项通过；含 POSIX precise-source、真实跨进程成本、缓存伪造、SHA-256 sealed
  prefix 篡改、幂等、跨段恢复和 runtime 行为。
- `node --test test/integration/incremental-append.test.js`：3 项通过。
- `pnpm check:sanity`：121 项通过。
- `pnpm check`：通过，147 项 integration、173 项 unit/runtime、35 项 contract，
  安装包 E2E、精确 pack、Markdown 和 skill checks 全部通过。
- `pnpm sync:skills`、`pnpm check:skills:local`：通过。
- `node bin/silvermoon.js check --worktree --audience agent`：通过。

在最终 release-grade 并行运行中，10001/100001 事件的 warm append snapshot
正文读取分别为 462/676 字节，runtime event 正文读取分别为 855/874 字节；
cursor snapshot 正文读取为 263/536 字节。Git racy-entry 判断会使有界尾段
读取次数变化，因此验收断言使用每项 <10000 字节且不读取 sealed body，
不使用偶然的精确次数、计时或“整个进程零 I/O”作为阈值。

后续候选已覆盖 alias 与 metadata 默认追加路径，Windows 原生来源算法已实施：

- alias interaction 通过同一 authenticated projection 解析全部 idea 的状态，
  同时保留完整 layout、world regularity、ULID 和 alias 唯一性检查；不按缓存
  alias 任意选择 owner。重复 alias 测试确认未写入任何候选记录。
- 用户明确允许 metadata 默认成功回执使用准确来源绑定的历史验证摘要，
  并保留显式完整历史输出。新增 `--full-history` 保留原 `base/candidate.state`
  及其完整消息数组；默认 `history.detail: "summary"` 给出准确 base/candidate
  length、folder digest 与 sequence。完整 replay 和审计不变。
- 默认 metadata 仍校验项目全部当前投影与准确 primary prefix，合法初始化和
  append-only 规则不变；新增事件只按单事件纯 reducer 验证。批准门依然比对准确
  当前世界、primary world、原前态生命周期与 `--confirm-decision`，
  不由 summary 授权，不刷新 stale 意图。版本/存储转换与明确 reduction-failed
  primary 使用原完整边界检查，回执标明 `detail: "full"` 及回退原因；
  format/cache 错误不能授权 repair。
- Git-private HMAC 文件处理提取到共享 `derived-cache.js`，避免 Windows 来源绑定
  与投影各自实现认证。Windows 用 runtime/root 绑定的已认证原生 stat→Git OID
  记录，不把 Node ChangeTime 与 Git CreationTime 混为一谈；无记录、原生 stat/
  OID 不符或粗粒度时间时强制重新读正文，构建前后精确来源复核仍保留。
  在本机可强制走该原生来源算法，恢复 mtime 编辑及伪造来源记录测试已通过。
  Windows 上私有数据继承 Git-private 目录 ACL；POSIX 显式要求 0700/0600。
- CI 的 Node 22/24 × Ubuntu/Windows/macOS 矩阵新增无条件 native incremental
  Git/CLI 测试步骤，实际 Windows runner 的读取量证明尚待运行结果。
- 本机 `node --test test/integration/git.test.js test/integration/incremental-append.test.js test/runtime/event-state.test.js`：
  29 项通过（随后补充 native-source tampering 单项并经完整 release 验证）。
  `node --test test/integration/git.test.js`：10 项通过。
- `pnpm check:sanity`：121 项通过；`pnpm sync:skills` 与
  `pnpm check:skills:local`：通过。
- `pnpm check`：通过；152 项 integration（149 passed、3 个既有平台跳过），
  173 项 unit/runtime、35 项 contract、E2E/pack/Markdown/skill 均通过。
  metadata 在 10001/100001 事件的真实 CLI 子进程中，warm snapshot 与 runtime
  event bytes 每项均 <10000，且不加载 sealed body；完整历史选项另有回归测试。

I-S02/I-AC02 尚不勾选，等待实际跨平台 CI 的原生来源及读取成本证据，
不是等待用户另行实施授权；没有记录 acceptInner。

### I-AC03: 幂等与并发准确

同一请求丢回执重试仅产生一个准确事件；不同请求同一前态不能冒认成功或互相覆盖。
跨段、后续追加、非法历史和 stale 均有准确结果与显式诊断。
以真实并发和 runtime 边界测试证明接收方不自动刷新前态重试旧意图。

已验证：不同 CLI 进程争用同一前态、同一请求丢回执重试、请求之后再有其他事件、
跨段准确前缀、相同长度但历史正文变化、不同请求同一前态和 offline interaction。
runtime 接受项目 Git object format 的摘要，不自行刷新或重试 stale 请求。

### I-AC04: 中断恢复保全未知工作

每个事务阶段中断后可恢复或准确回滚；未知字节、活动 writer、来源变化或竞争恢复
均阻挡，不丢工作、不产生半完成成功回执。以故障注入和真实文件系统测试证明，
并明确测试覆盖的进程中断保证及未覆盖的硬件掉电保证。

已验证：事务 prepared/applied 阶段、跨段新文件尚处 pending 时的恢复与回滚、
V1 迁移及内部 V2 分段迁移的进程退出注入、primary 移动、未知字节与并发来源修改。
自动化证据是进程中断测试，不是硬件掉电测试。
另已验证：多段 revise 删除中间段后中断产生临时段表缺口，resume 能先从准确
事务计划重建完整候选，再验证历史与应用；rollback 恢复原始全部段。
内部迁移期间并发 world 编辑不会被覆盖，操作保留显式恢复屏障。

### I-AC05: 内部迁移等价且边界受控

准确来源的全部旧 V2 流迁移后事件顺序、payload、sequence、身份和决策状态等价；
重复调用不重复迁移，来源/primary/候选变化与未知工作安全阻挡，中断可恢复。
以迁移前后逐记录比较、归约对照、历史边界与故障测试证明。
包内容和 CLI 测试证明没有新增对外迁移命令，既有 V1 迁移能力未被误删。

已验证内部工具的只读计划、来源 runtime/repository/manifest、2001 条跨三段
逐字节等价（包括既有 ideal 决策）、dirty/错误来源阻挡、重复调用和恢复/回滚。
旧 dotted V2 内部转换及 V1 到 V2 suites 继续通过。内部工具明确排除在 npm 包之外。
本源码 checkout 的实际转换及其 primary 边界证据如下，不以 fixture 代替。

实际源仓转换已执行并普通同步：

- 实施代码来源/primary：`488d25860c5ac352792d5884335f1ca7f7a9ab99`。
- `node bin/migrate-segmented-events.js --root /Users/weiwei/Code/silvermoon.worktrees/create-silvermoon-idea-session`：只读计划成功，
  plan digest 为 `a40649e840af1ea6dd497ea7e66ede50b77ba8666ef634e6c82f48c4f28db7c1`。
- `node bin/migrate-segmented-events.js --root /Users/weiwei/Code/silvermoon.worktrees/create-silvermoon-idea-session --apply --expected-digest a40649e840af1ea6dd497ea7e66ede50b77ba8666ef634e6c82f48c4f28db7c1`：成功，41 条 idea 流同时转换；
  156 条事件、16036 原始字节逐流与来源 commit 的旧文件完全相等，归约结果相同。
  逐 idea 的完整 outer tree 和 ledger blob、项目 config blob 均与来源相同，仍为 V2。
- 重复运行只读入口：`already-segmented`，`written: false`。
- 独立 migration-only commit：`926ddd7ff8a2e958c1d38e77abcad927396070ca`；
  Git 显示 41 个 100% rename、0 insertions、0 deletions。
  未修改任何 world 或 ledger；其他工作区及原 daemon 讨论稿未操作。
- `node bin/silvermoon.js check --worktree --audience agent`：通过。
- `node bin/silvermoon.js check --staged --audience agent`：通过。
- `node bin/silvermoon.js check --commit HEAD --audience agent`：通过。
- `pnpm check:commit`：通过；普通 push 前核对 primary 为准确来源 commit。
  push 后重观 implementing，`node bin/silvermoon.js check --remote --audience agent`
  通过，迁移 commit 已在 primary。

### I-AC06: 全相关表面和交付验证一致

schema/layout、脚手架、读取/回放、写入/历史验证、primary Git 比较、
runtime、类型、文档与 skill 全部使用同一契约。以定向测试、类型检查、
`pnpm check`、`pnpm check:skills`、metadata checks 和普通同步可达性证据证明。
验证记录必须包含实际命令与结果，不把未实施步骤或仅生成的计划标作完成。

2026-10-02 当前代码候选验证：

- `node --test test/runtime/segmented-events.test.js`：4 项通过，含临时段表缺口恢复。
- `pnpm check:sanity`：121 项通过。
- `pnpm check`：通过；170 项 unit/runtime、35 项 contract、141 项 integration、
  安装包 E2E、精确包内容、Markdown 与 `check:skills` 均通过。
- `node bin/silvermoon.js check --worktree --audience agent`：通过。

I-AC02 未完成，不把测试全绿当作性能验收，不记录 acceptInner。

迁移后的真实源码 layout 又运行一次 `pnpm check`：全部通过，覆盖与上述相同。
实施代码和 migration-only 两个 commit 均经 worktree/index/commit checks、
`pnpm check:commit` 及普通非强制同步，remote history check 通过。
最后证据/ledger 候选仍按同一流程提交与同步。当前实质剩余为 I-S02/I-AC02：
必须补足生产路径增量读取，不得以库内不可变 snapshot 的增量哈希代替该证明；
I-S07 不勾选，不进入 acceptInner 人工门。
