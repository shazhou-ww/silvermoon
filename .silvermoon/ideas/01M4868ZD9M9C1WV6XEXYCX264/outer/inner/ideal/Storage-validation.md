# 分段、同步、迁移与规模证据

服务于 [Idea.md](./Idea.md)；语义见 [Event-model.md](./Event-model.md)。
这是实施前可审查约束与验证方案，不是已经运行的 benchmark 或迁移工具。

## 逻辑与物理分开

采用每 idea 两个分侧分段目录 `events/upstream/`、`events/downstream/`，
各侧段名为连续 16 位正序号 `.jsonl`，段内沿 after 链顺序。
每侧空历史仅有空首段；不建空尾段。尾段追加不改旧记录；封段永不改写。
条数 N 与段字节上限 B 任一将被超过时，封存非空尾段并创建新段；单记录
不超过 1 MiB 且 B 不小于单记录上限，不分割记录。非尾段须按其下一条确实会
超过阈值或已达阈值验证，不能为了 merge 任意提前封段。

分侧尾段有必要作为本候选：对侧并发追加不争同一文件，不需要把已有记录
重新打包。它不是同侧多 writer 的分布式锁；同侧 fork 仍必须阻塞。阈值属于
schema 已验证的项目存储配置，同一项目所有 writer 一致；未经显式存储转换
不得中途改值或重排段。N=1000 为对照，最终 N/B 由矩阵测量后在 Implementation
精确指定；若不能满足预算，返回 Ideal 修订，不无限堆大尾段。

规范 JSONL 保留 LF/UTF-8 与 `-text -filter` 属性；新目录须更新匹配规则。
未知 entry、symlink、irregular file、篡改/重复记录为明确错误。相同节点的网络
重投不重复存储。迁移审计附件不混入原生链，采用独立的版本化严格格式。

storageDigest 是完整规范 events 目录 Git tree OID（固定 100644、原始 blob、
规范子目录），含迁移审计权威内容；跟 repo Git object format 一致。
它随布局/字节变动，与 DAG frontier/eventId/世界 revision/repo HEAD 分开。
不能以节点集合等价声称 storage digest 一样，或用 frontier 掩盖物理篡改。

## 索引、cursor 与认证

eventId -> source/segment/byteOffset/byteLength 索引为可重建派生物，仅存 Git
private 的 worktree 隔离目录，不入 repo、不成为第二权威。命中后读实际记录、
重新核验 hash/ref；cold miss 可以显式重建，但不能成功返回未验证节点。
缓存无文件与缓存损坏区分：缺失可重建，认证失败/异常路径/未知来源明确错误。

认证上下文覆盖项目/idea、schema/阈值、runtime source identity、完整 segment
blob 表、frontier、storageDigest、迁移审计摘要和 reduction/index 版本。
沿用本机私钥认证与 POSIX 精确 stat / Windows native ChangeTime 内容绑定的
验证基础；不能靠 mtime/length 相等略过内容。完整审计仍读全量权威历史。
缓存/key/lock/cursor 不提交，不包含新的批准事实或消息副本权威。

V3 cursor 含 version、ideaId、frontier、storageDigest 与两侧准确物理
{length,digest} 边界；完整 replay 初始化后才可增量。验证旧 frontier 的祖先
闭合集合、两侧字节边界、历史段表与当前前缀一致，再按稳定拓扑序返回新增节点
和新 cursor。delta 不包含完整归约有效性承诺；消费成功后才保存新 cursor。
无变化返回空数组；缺父、同侧 fork、未知 id、改/删前缀、非记录边界、错误
schema 及不闭合 cursor 明确拒绝，不自动从头开始、不把排序 rank 当 cursor。
旧 V2 length/digest cursor 在 V3 明确不兼容，迁移后须完整 replay 初始化。

## 原子追加和并发

复用项目级独占可恢复事务，锁内重读所依赖的完整 snapshot、目标侧 tip、
段边界、world、角色及 primary 前态；记录原始和候选字节，fsync 后 rename，
完成全候选验证才返回回执。同侧多个本机 writer 一人成功、另一人 stale；
不同 worktree 同侧 writer 可以各自产生合法本机候选，但 primary 合并遇 fork
必须阻塞，不能用本机锁声称 distributed exactly-once。

pong 仅容许同侧 tip 未变、对侧扩展且原 observed 前缀仍真实可验证；复用
原 envelope，计算当前合法合并候选，不拒绝无关对侧消息，也不声称判断了它。
metadata/决定/ping 保持完整快照绑定。already-present 核验准确 id、规范字节
与原前态祖先；不是“相同 payload 已有就成功”。回执分 candidate-written、
already-present、no-state-change，均不表示 primary 已同步或任务完成。

中断后普通命令阻塞，确认原 PID 停止并检查计划/原字节/候选字节后，显式完成
或恢复准确事务；外部编辑与未知字节阻塞，不按锁年龄删除、不隐式重发。
Windows 无目录 fsync 的限制必须保留，进程恢复不承诺硬件掉电持久性。

## Git 历史与合并

不同侧 append 通常文件级可合并，但仍验证 DAG、归约与世界授权；metadata
冲突不会因为文本 clean merge 消失。同侧尾段文本冲突不采用 ours/theirs，不
拼接两支为一条链。同侧 sealed 段被改写是历史错误。
历史 gate 验证全部 primary 已存在节点及规范字节保留、各侧祖先关系和段前缀；
不是只比较最新 frontier。merge commit 检查各父的事实保留，不只第一父。

刷新 primary 后普通 fast-forward/merge，再验证实际旧 tip 到候选的边界，普通
非 force push 后确认可达。primary 移动时保留双方历史并重新观察，决定不能
换 revision 或改 observed 重放。合法新事件追加是节点集合单调扩展；异常
维护/迁移单独报告，不能因缺对象/parse/cache 错误得到修复豁免。

## Schema 与显式迁移候选

V1 status 与 V2 segmented 原生格式继续按各自版本读写，不更改 V2 grammar，
旧正式兼容范围写入 docs/schema/API capability。V3 未支持的消费方明确
unsupported-capability；普通安装、查询、daemon 与 append 不迁移。
新迁移入口只在准确 Ideal 批准后开发，不恢复已删除旧 internal/segmented 工具。

V2 没有可靠 source/observed 事实，尤其 metadata 属双方，不能凭业务类型
伪造整条 upstream/downstream 历史。候选导入方案如下：

1. read-only plan 固定 config、全部 ideas、世界/ledger、完整旧事件原字节、
   primary、格式与 reduction，输出版本化 plan digest 和逐项差异。
2. V3 每 idea 保留 `events/import/` 中不可变旧格式段和严格 manifest；
   manifest 记录原 schema、段 Git blob 表、原 length/digest、迁移前投影，
   从原段重放核验，不靠 manifest 投影自证。V1 另保留准确 status 原字节。
   它是权威历史审计基底，不是缓存，不伪称历史因果。
3. 原生双链从空 roots 开始，归约先应用验证过的导入基底，再应用新 DAG。
   任何新写入的语义前态包含全部导入事实；import 不冒充 observed 对侧节点。
   原生 envelope 无 import 字段，因此同 idea 不同导入基底不能交换追加；
   受控操作/cursor/storageDigest 必须绑定准确基底，history gate 禁止基底替换。
4. 对 V2 全部九种事件按原 sequence 重放，保留每条消息/决定/旧或不完整
   revision，不只保留最后 status。不产生新批准，不虚构历史人类授权。
   V1 只保留存在的事实，不能补造其未记录的消息或历史决定。
5. apply 须显式项目升级授权、准确 plan digest、干净 committed source、
   同步 primary、项目级事务；所有 ideas/config 同批变更。校验原始事实与
   候选审计重放、三个世界、ledger、有效语言/alias 和五态结果逐项等价。
6. resume/rollback 显式确认原 writer 停止、核对计划与当前字节，不覆盖未知
   工作。未写新 V3 事实前可恢复准确旧快照；接受新事实后禁止自动 downgrade，
   另行设计转换并取得授权。迁移完成先验证并同步准确边界，再追加新节点。

保留旧段与规范原生内容 hash 不是双份状态权威：import 只定义已封存的历史
前态，新事件只定义其后的事实；任何 projection 可丢弃重建。V3 新建 idea
没有 import，empty graph 不等于导入 idea 没有历史事实。

## 可复现规模矩阵与预算

既有源码证据：event-store/stream 使用不可变段、共享 sealed blob，仅 rehash
尾段和 flat 段表；event-reducer 保持准确人类 gate；event-cursor 与
projection-cache 已有认证快路径。新 DAG 不能因此声称全量 O(1)。
本次仅有设计/源码阅读证据，没有运行 DAG 性能测试。

实施使用固定 seed 的 10k、100k、1m 节点，两侧 50/50 和 99/1 分布；
消息大小含 256 B、4 KiB、接近 1 MiB（后者以 10k 为容量上限并公开总字节）。
交替/突发、metadata、准确决定、并发/fork/损坏分别构造。参数对照 N=100、
1000、10000，B=1、4、16 MiB，以及当前 V2 1000 条基线。不可测的组合须说明
硬件容量/耗时上限，不以省略样本冒充通过。运行 5 次，保存各次和中位/p95；
Windows 与 POSIX、Git SHA-1/SHA-256、冷/暖索引/投影均覆盖。

| 操作 | 必须记录和验收的可观察预算 |
| --- | --- |
| 单节点追加/段轮转 | latency、读取/解析/写入/hash 字节、峰值内存；warm 不读 sealed 正文，重写最多一个尾段或新段，段表成本单独报告 |
| 按 id 查询 hit/miss | cold 建索引全量成本单列；warm hit 最多读一个段正文，miss 不偷偷全量扫描；篡改必须检出 |
| after 链与 delta | k=1/100/1000；正文读取随覆盖段/节点增长，不随完整历史线性增长；边界证明及段表成本单列 |
| 全量归约/校验 | 所有节点/引用/hash/导入核验，近似 O(V+E+bytes)，报告内存；100k 到 1m 的 CPU/正文 IO 不得超过 15 倍 |
| Git | add/commit/status/diff/fetch/merge/push，真实本地 bare remote；同侧/异侧冲突，pack 总量及变动量，不能只测 hash |
| 文件数 | 正文文件=两侧实际 segment 数加可解释 import/manifest；不存在按 event 数新增文件，列出派生索引文件数 |

选中的 N/B 在小消息 warm 追加/id 查询上不得比 V2 对应操作 p95 慢超过 2 倍；
硬件、采样与正文长度须可比，V2 无原生 id 查询时使用公开的 scan/index 对照，
不能虚构 V2 接口。全量 CPU/IO 与上述结构预算必须同时满足。Git p95 与峰值
内存目标在 Implementation 先按实测 V2 基线明确，不能测完才放宽目标。
未达标须记录失败、解释瓶颈并重试合理参数；若约束冲突则修订 Ideal 请求批准。

正确性矩阵包含 rollover（条数/字节）、尾段追加保持旧 id、重复 key/hash 错误、
观测倒退/缺口/循环、同侧多 writer、abandon || pong、不同 accepted revision、
metadata 并发消解、真实 Git 合并各父保留、异常事务恢复、缓存/key/source/
ChangeTime 篡改、V1/V2/V3 混合能力诊断和迁移回滚。
最终 CLI/schema/模型/skill 交付须 `pnpm check:sanity`、专门测试、
`pnpm check:commit`、`pnpm check` 和准确 worktree/staged metadata 验证；
源码 checkout 永远使用自己的 `node bin/silvermoon.js`。
