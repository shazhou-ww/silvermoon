# Idea events 的 Merkle DAG 演进

## 意图

将 idea 事件从单一 sequence 流演进为内容寻址的 upstream/downstream 双链
Merkle DAG，保留分段存储、准确人类决定与可验证历史。因果关系解释判断依据，
不替代生命周期、执行完成或授权。

## 背景

现有 V2 每段最多 1000 条、单条含 LF 最多 1 MiB，sequence 连续；
HEAD/cursor 是规范 events folder Git tree OID 加逻辑字节长度。全流前态绑定
可靠但把对侧的新消息也视为 stale；事件身份依赖位置，不表达各侧判断的依据。

来源背景为父 idea `daemon-event-bridge` / `01M3SJ90WVJB56Z1PP72BPAHFZ`，
交接 commit `add6dd0d594c51e3ac3964e89cde230c86c5172c`。其
[Idea.md](../../../../01M3SJ90WVJB56Z1PP72BPAHFZ/outer/inner/ideal/Idea.md)、
[Key-decisions.md](../../../../01M3SJ90WVJB56Z1PP72BPAHFZ/outer/inner/ideal/Key-decisions.md)、
[Message-encoding.md](../../../../01M3SJ90WVJB56Z1PP72BPAHFZ/outer/inner/ideal/Message-encoding.md)
和 [Protocol-types.ts](../../../../01M3SJ90WVJB56Z1PP72BPAHFZ/outer/inner/ideal/Protocol-types.ts)
是讨论来源，不是本 idea 已批准的接口。通信消息的 channel/sender 身份模型
不直接搬入项目事件；事件 topic 为 idea，source 为 upstream/downstream。

## 期望结果

本契约及同世界附件共同定义待审查候选：

- [Event-model.md](./Event-model.md)：编码、双链、归约与语义变化。
- [Storage-validation.md](./Storage-validation.md)：分段、事务、Git、缓存、
  兼容迁移和规模验证。
- [Event-types.ts](./Event-types.ts)：候选数据形状；不是当前发布 API。
- [Preparation-evidence.md](./Preparation-evidence.md)：本轮准备验证与证据边界。

### AC01: 内容身份和因果连续性

规范 envelope 的 SHA-256 决定 eventId，id 不参与自身 hash；追加尾段不会
改变已有 ID。after 为同侧前一节点；单个 observed 为实际纳入判断的对侧连续
前缀末端，不能跳过、倒退或伪报处理。测试覆盖双根、缺父、错侧/idea、循环、
同侧 fork、字节编码错误及相同内容重投；不自动补 refs。

### AC02: 确定性而非猜测的生命周期

对同一有效节点集合的所有合法输入排列归约结果相同。冲突返回具体节点和字段，
阻止生命周期动作，不用 hash 排序选赢家。准确 revision 上的明确人类决定、
primary 同步与受控 gate 保持；一般消息、DAG frontier 和 ledger 均不批准。
验证矩阵必须包含 abandon 与旧 pong 并发、不同 accepted revision 和 branch fork。

### AC03: 分段与可靠增量

分段是基线，不采用一文件一 event；已封段不改写。按 id 查询、after 链读取
和 frontier 增量都验证权威节点，缓存只加速。旧 cursor、缺口、替换前缀及缓存
损坏明确诊断，不成功形状回退。原子事务、同侧多 writer 与 Git 合并测试证明
不丢事实、不重复决定，不隐瞒未知结果。

### AC04: 显式兼容和迁移

V2 尚未发布，本次直接重设计 V2，不另立 V3 或承诺旧 V2 长期读写兼容。
V1 的既有支持不变；已落盘的未发布 V2 仍须显式转换，不能当作可丢弃数据。
转换须显式授权、
准确计划、完整验证、可恢复事务和普通 Git 集成；不静默升级本仓库。
旧事实与决定完整保留，不能伪造历史观测/身份/批准；迁移前后世界、ledger、
生命周期投影和全部消息逐项比较。

### AC05: 可复现规模证据

依 [Storage-validation.md](./Storage-validation.md) 测量追加、id 查询、
after 链/增量、全量归约校验、Git 操作及文件数，包括冷/暖缓存、SHA-1/SHA-256、
Windows/POSIX。提交环境、命令、数据种子、原始结果及失败；不凭 hash 宣称更快。
分段条数和字节阈值必须在实施候选中依据证据确定，未通过预算不能声称验收。

## 范围

### 范围内

新 schema/envelope、双方链/frontier、冲突策略、受控写入/重试、replay/delta/
id 查询、归约与生命周期衔接、存储索引和认证缓存、显式迁移/恢复、CLI/API/
声明/schema/文档/skill 的一致性，以及针对既有行为的回归和端到端验证。
批准后先建立 Implementation 契约及匹配 ledger，再实施上述交付。

### 范围外

daemon/WSS/SDK 通信接口实现、general transcript、身份认证系统、自动 fork
合并决定、新的撤销/审批语义、恢复已删除的 internal/segmented 迁移工具、
本仓库的自动迁移及 npm 发布。不得修改父 idea 的无关契约。

## 约束

此候选未获 acceptIdeal；用户授权创建/设计不是对尚不存在 revision 的批准。
本次只完成 Ideal 与附件；下游契约和 ledger 保持一致未完成占位。
现有 V2 事件只通过当前受控 append 设置本 idea alias，不能手写 JSONL。
新 API 的精确命令形状须在实施中覆盖 parser、声明和测试，不能把候选类型
当作已可调用入口。交付 CLI/schema/模型/skill 前运行 release-grade `pnpm check`。

## 待解决问题

1. 每侧分段候选的条数/字节阈值尚无实测；1000 条只是对照，不预先承诺保留。
   实施需按规定矩阵选择参数。超预算若需改变本契约须返回 preparing。
2. 双链历史迁移的显式导入来源和兼容审计类型见存储附件，需重点 review：
   不能用 observed 声称历史参与者真的读过输入。
3. 并发旧 pong 的记录许可、消息 lastSignal 的并发表达及 metadata 冲突为明确
   行为变化，须审查本完整 idealRevision；不会凭父 idea 草案自动批准。
4. 是否需要非连续输入语义目前没有具体用例：候选只用 observed。
   若实际协议需要选择性处理，先提供无法连续纳入的案例并修订 Ideal，不加 inputs
   数组或默默扩大其含义。
