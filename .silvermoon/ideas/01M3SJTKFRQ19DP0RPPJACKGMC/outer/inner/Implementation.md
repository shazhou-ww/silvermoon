# Implementation

## Steps

<!--
为每个步骤分配稳定的 I-Sxx 标识符和三级标题。
说明修改内容、边界和重要设计细节。
不要在本文档中使用任务列表复选框。
-->

### I-S01: 实现最小事件核心与严格 schema

以已批准的 ideal revision `519ebd3b273c99f8c4f1d40b8effb163df1763e2`
为边界，将 Ideal World 的七种事件与纯 reducer 落地为源码仓库现有的
ES module JavaScript，不把审阅用 TS 直接当生产入口。
复用 `src/ideas.js` 的字段验证与五态规则，避免维护两套不同的状态语义。
新增独立事件 schema 与规范 JSONL 解析/序列化，拒绝未知字段、重复 JSON
key、非规范记录和非法序号；空日志从目录身份建立初态。
区分解析/格式不可用与纯归约 `ok: false`，供修复规则准确判定。

### I-S02: 接入 v2 项目读取与创建

扩展 `config.js`、`layout.js`、`idea-layout.js` 和 snapshot 预载路径，
按项目格式选择 v1 status 或 v2 events，拒绝混合布局与双权威。
v1 项目及历史仍可读取；v2 `create-idea` 创建空日志，有显式语言等初值时
经同一事件路径初始化。`list-ideas`、`whats-next` 和 `check` 统一使用投影，
保持 alias、语言继承、筛选、世界 revision 与只读查询行为。
本次开发不自动升级本仓库 `.silvermoon/config.yaml` 或迁移现有 idea。

### I-S03: 实现基线检查与修复例外

为工作区、index、commit 和 remote 明确候选与固定 primary 基线。
独立校验完整候选和基线归约：base 成功则要求字节前缀，base 明确归约失败
则允许修复旧事件，但完整候选须通过。必要对象缺失、读取/解析失败和
内部异常不得当作该修复许可。按 idea 判定，不跨 idea 放宽。
审计 primary 集成主线并识别已验证修复边界，不将坏祖先永久变成恢复障碍。
输出基线、候选和实际使用的追加/修复规则，保持 check 退出码约定。

具体基线选择落在 `src/event-history.js`：本地目标固定匹配配置坐标的
named remote tracking ref，并标注尚未 fetch；remote 目标使用本次 fetch
返回的准确 OID。已集成提交沿 primary first-parent 审计；可 fast-forward
的本地提交还需逐步合法，否则保留双方历史并形成 primary 为首父的合并。
真正 v1 历史仍按快照读事实；额外查看配置历史仅用于阻止 v2 降级。

### I-S04: 接入受控追加、修订和恢复指引

通过项目 CLI 提供事件追加、回放、候选修订及符合 I-S03 的修复路径，
沿用四投影报告与 agent audience，不增设事件审计字段。
写入请求绑定准确日志前态的序号和摘要，持锁复核后写入完整候选；
处理重复请求、部分成功、并发和崩溃，明确本地写入与 primary 集成的区别。
写入层复核明确人类决定和准确世界，不将授权验证塞进纯 reducer。
`whats-next` 和 skill 在冲突时指导保留现场、同步、重审、重验；
base 失败时指导修复而不是无限要求追加。所有重试保留 selector/audience。

生产命令为 `event replay|append|revise|recover`。
append 输入单个 `{ type, payload? }` JSON 请求；revise 输入完整候选请求
数组，不让调用方分配 sequence 或编辑 JSONL。写入参数采用
`--expected-length`（字节数）、`--expected-digest`（SHA-256）和
`--expected-primary`。`--confirm-decision` 是对已有明确人工决定的断言，
不伪称授权证明；`--owned-suffix` 是对待修订后缀归属和意图的确认。

共享 `src/state-transaction.js` 在 `.silvermoon/transaction` 保存完整
原始/候选字节，借同目录 hard link 原子发布恢复计划并取得排他权。
候选文件先 fsync，再同目录 rename；中断后只接受准确原始/候选字节。
`event recover --confirm-stopped` 重验 primary 和世界；
`--rollback` 仅恢复操作自己的准确原始字节，不覆盖后来新增事实。
恢复进程本身若被终止，保留 `transaction.recovery`，由操作者停下所有
恢复参与者、核实 PID 和原计划后明确移除这个互斥文件；不自动抢锁。
Windows 的 Node API 无目录 fsync 保证，因此承诺进程中断恢复，不把
测试结果表述成硬件断电持久性保证。POSIX 另外同步目录项。

### I-S05: 实现独立的一次性迁移

交付 `bin/migrate-v1-to-v2.js`，不注册到常规 CLI，不自动运行。
固定来源、备份及输出计划，从目录身份和已知旧字段生成普通事件；
仅 id 的旧状态生成空日志，已过期或不完整决定组合也原样保留。
项目级预检、切换、恢复和重试保持来源可恢复，不制造重复事件或新决定。
将迁移边界接入历史检查，不依赖 imported 事件或逐行 commit 元数据。
只对测试夹具和明确选择升级的项目执行，不使用真实 idea 做隐式试迁移。

独立入口默认只生成只读计划；`--apply --expected-digest` 绑定准确计划，
要求干净且已提交的源状态。`--resume`/`--rollback --confirm-stopped`
使用原事务恢复；源 commit 或字节变化则阻塞。迁移边界须先验证并集成，
之后再追加新事实；check 比较旧 primary 事实及固定普通事件表示。

### I-S06: 完成文档、skill、集成与交付证明

更新直接相关的存储/命令/检查文档和 canonical skill，执行 `pnpm sync:skills`。
扩展现有 unit、contract、runtime、integration 与 installed-package E2E，
包括 Windows 文件写入和实际 Git 基线/合并，不能用纯 reducer 测试替代。
迭代使用 `pnpm check:sanity` 与专项测试，提交前 `pnpm check:commit`，
交付前 `pnpm check`；执行 skill 本地一致性和外部发现检查。
将实际结果记入 ledger，同步实现候选后请求准确 implementation revision
验收；不触发部署验收或 npm 发布。

## Acceptance criteria

<!--
为每项标准分配稳定的 I-ACxx 标识符和三级标题。
同时说明可观察结果及其证明方法。
不要创建单独的验证章节，也不要使用任务列表复选框。
-->

### I-AC01: 七种事件完整且克制

schema 与运行时仅接受批准的七种事件及必要参数；不出现 created/imported、
retracted、审计 Envelope、repo commit 或持久观察。
用 schema contract 和纯单元测试覆盖每类合法转换、非法输入、无操作、
空日志、重复/跳号/倒序、输入不可变及确定性回放。

### I-AC02: 旧事实与五态行为保持

合法 v1 字段组合迁移后逐项相等；相同世界观察产生与旧算法相同的五态。
自动测试覆盖缺失字段、显式语言、放弃、过期及不完整决定组合，
以及 ideal/inner/outer 变化和精确还原的级联效果。
实际命令证明查询真实 revision 而不写日志，不要求先记录世界观察。

### I-AC03: 检查准确区分追加、修复和不可用

真实 Git 夹具证明正常 base 的改写/删除/重排被拒绝；
归约失败的准确 base 可修改修复，合法候选通过后恢复 append-only。
候选自身失败不解锁正常 base，其他 idea 失败不解锁本 idea。
缺历史、解析失败、读取异常均明确失败，修复不受坏祖先永久阻塞。
分别验证 worktree/index/commit/remote 的目标与基线，不错用相邻版本。

### I-AC04: 并发写入和修订安全

并发进程和真实分支测试证明同序竞争先冲突，后到者同步重审而非自动换号。
测试旧摘要、重复请求、第二条事件失败、崩溃与恢复，确保回执准确、
文件完整、未知修改保留；修订只影响允许的候选后缀或明确失败基线。
primary 移动后重新判定规则，旧修复许可不能改写已恢复的新 base。

### I-AC05: 迁移显式、完整、可恢复

独立入口在无 daemon、无真实 Agent 的夹具中完成项目升级并移除旧权威文件。
故障注入覆盖预检、准备、切换各阶段；重试输出一致且不重复决定，
未完成事务阻塞常规写入，来源变化不被覆盖。生成顺序不声称历史顺序。
确认普通 CLI/安装不迁移，源码仓库仍保持原 schema，未授权 npm 发布。

### I-AC06: 全部入口与发布级检查通过

v1/v2 读取、v2 创建、受控事件命令、报告、文档、skill 和包内迁移入口
在现有检查体系下同时可用。`pnpm check` 与 skill 检查通过，源码无自依赖，
实现证据可复现；仅通过 metadata check 不算实现完成。
