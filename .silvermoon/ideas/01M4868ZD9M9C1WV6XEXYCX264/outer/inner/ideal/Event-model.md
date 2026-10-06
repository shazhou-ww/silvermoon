# 事件身份、因果与归约候选

服务于 [Idea.md](./Idea.md)。本文是 V3 项目事件契约，不是通信消息协议。
类型见 [Event-types.ts](./Event-types.ts)。

## Envelope 与规范字节

原生节点为 `{ id, envelope }`。envelope 恰好含 version: 1、ideaId（规范
ULID）、source（upstream/downstream）、after、observed 和 body。
body 保留既有九种 type/payload：setAlias、setLanguage、acceptIdeal、
acceptInner、acceptOuter、abandon、resume、ping、pong。message 不新增为事件
type；普通消息仍由 ping/pong 的非空 payload.message 表达。无 timestamp、
actor、channel、sequence、commit 或任意 patch 字段。

```text
id = "sha256:" + lowercaseHex(SHA256(
  UTF8("silvermoon.idea-event.v1\n") + UTF8(canonicalEncode(envelope))
))
```

递归按 UTF-16 code unit 排序 object keys；数组保持顺序；字符串采用 JSON
转义、无 Unicode 归一化，安全整数，-0 规范为 0。拒绝重复 key、非法 UTF-8/
surrogate、浮点/非有限数、undefined、未知/缺失字段。对象无空白、BOM、尾 LF；
存储记录为 canonicalEncode({id,envelope}) 加 LF。hash 与 repo Git SHA-1/
SHA-256 格式独立。单记录含 LF 仍不超过 1048576 字节，超限明确拒绝。

payload alias/language 的既有格式、null 清除规则与三种 world Git OID 校验
保持；三世界 revision 随 Git object format，不能用 eventId 替代。
相同 id 重投须有同一规范字节；相同 body 不等于相同事件，新 after 代表新节点。
重试保留原 envelope，不刷新 refs 后冒充重投。无状态变化的 metadata 仍返回
no-state-change，不追加假事实。

## 双链与 frontier

after 是同 idea、同 source 的紧邻前一事件，首条为 null；每侧只允许一个根和
一个 tip。observed 是对侧实际纳入判断的连续前缀末端，尚未纳入为 null。
它继承同侧 after 的观测进度，必须在对侧 after 链上相等或前进；不能回 null、
跳过未纳入节点或引用自己/同侧/别的 idea。引用 tip 声明整段已纳入判断，
不是只收到最后节点，也不声称任务完成。运行时需要可验证的消费依据；仅靠
节点结构只能证明前缀可达，不能证明人的认知或 Agent 实际处理。

两种 refs 都是因果边。缺父拒绝有效归约/追加，传输可明确等待补齐；全图必须
无环。同侧两节点共享 after（含双根）为 fork，哪怕 body 相同也不自动选一支。
frontier 为两个准确 tip 或 null，唯一识别已验证双链的闭合节点集合。
空图是两个 null；frontier 不含 world 内容，不是授权或完整项目快照。

source 是业务来源约束，不是密码学认证。accept 三类、abandon/resume、ping
只允许 upstream；pong 只允许 downstream；metadata 两侧可用。本机受控
接口核验调用角色与明确决定；CLI 的角色参数本身不证明人类授权。通信
sender:silvermoon/agent、channelId 与 event source 分开，不互相推断。

## 归约，不把偏序伪装成顺序

先完整验证 DAG，再计算各字段的因果极大写入集合，不能按目录位置、Git merge
顺序、hash、时钟或任意 topological 排序采用 last-write-wins。

| 领域 | 确定性规则 |
| --- | --- |
| alias/language | 单个极大写入生效；并发同值合流；并发不同值（含 null）返回字段冲突和全部节点 ID |
| 批准/验收 | upstream 单链上的最后对应明确事实，继续使用既有五态 revision 比较算法，不要求历史 revision 等于当前树 |
| abandon/resume | upstream 链的最后状态写入；abandon 保留既有决定，不清空批准或结果 |
| messages | 全部保存；显示按稳定拓扑序（可用 source 后 id 打破并列），显示顺序无治理含义 |
| lastSignal | 因果极大交互节点同 type 时为该 type；并发 ping/pong 时为 null，另返回 concurrent 与 tip IDs；null 不代表无消息或完成 |

有导入基底时，它在归约中先于全部原生节点；尚无原生字段写入时保留基底值，
尚无原生交互时保留原 lastSignal。导入消息按旧 sequence 展示在原生消息之前，
保留其旧标识，不伪造 EventId；交互投影将导入记录与原生节点明确分开。

metadata 冲突期间只允许受控、非人类决定的冲突消解写入：新 metadata 的 after
与 observed 必须覆盖全部冲突节点，对所冲突字段显式给值。其他业务写入阻塞，
查询可返回冲突和所有事实但不返回可执行 lifecycle 指令。解决跨 idea alias
重名还须项目级唯一性校验。语义冲突不等于格式损坏，不能获得历史修复豁免。

原生事件的因果祖先已 abandoned 且未 resume 时，除 upstream resume 外拒绝
业务事件；重复 abandon/resume 沿用既有归约有效性规则。同侧 fork 是结构冲突，
不能以覆盖 metadata 消解：停止推进、保留双方候选，人工核对未集成后缀及授权。
不自动改父、删分支、增加 fork-merge/撤销决定 type；若须改历史，只能另行明确
授权维护，验证完整集合/准确世界与普通 Git review，不能伪装为普通追加。

### abandon 与旧 pong

候选允许 pong 的对侧已增长但未被其 observed 覆盖时记录原 envelope，只要
同侧 after 仍是准确 tip、其因果前态可写且当前没有结构/metadata 冲突。
因此与 abandon 并发的旧 pong 保留为事实，但最终状态为 abandoned，不能
唤醒执行、自动 resume 或验收。pong 若观察了尚未 resume 的 abandon 则拒绝。
先收到 pong 或先收到 abandon，归约同一集合必须相同；该规则是对 V2 的
“abandon 后只允许 resume”和完整 HEAD stale 拒绝的显式变化，限 V3。

ping 的因果依据不能伪装覆盖尚未判断的 pong；也不承诺每 ping 一个 pong。
连续 pong、无 ping 的 pong、报告阻塞/失败仍有效。DAG 不新增已处理任务事件。

### 精确人类 gate

acceptIdeal/Inner/Outer payload 始终显式绑定准确对应 world revision，不从
observed 推断批准对象。受控参数绑定当前完整 frontier、storage digest、
primary commit 与三世界快照；实际 world 和当前 phase 必须与批准对象匹配，
候选已在 primary 可达且有明确人类决定。abandon/resume 同样要求明确决定。
append 前、事务锁内和最终 primary 重检查；变化返回 stale，不能刷新候选重放。

不同 accepted revision 若来自同侧 fork，保留两者并报告 fork，不挑最后 hash；
合法 upstream 链上的后来事实按既有 revision 算法生效，历史事实仍可审计。
对侧普通消息变化也会使尚未写入的人类决定前态 stale，不把旧授权自动重绑定。

## 新旧行为边界

| 行为 | V3 候选 |
| --- | --- |
| 九种业务 payload、非空消息、准确 revision | 保持；不与网络 message 混为一谈 |
| 全局 sequence | 不再是事件字段；物理序号/显示 rank 仅是派生位置 |
| interaction 全 HEAD stale | 只对 pong 放宽对侧增长；其余写入保持准确完整前态 |
| lastSignal 单一线性最近值 | 并发混合 signal 显式 null/concurrent，不推断最新意图 |
| 既有 auth/sync/gate | 保持并强化准确 frontier 绑定；hash 不认证 source |
| 结构冲突/缺父 | 明确阻塞，不 silent repair，不给可执行成功指令 |

测试须覆盖实际 CLI/API、候选类型、状态报告与消费方，不仅验证 hash 或 reducer
纯函数。daemon 若尚未支持 V3 concurrent signal，capability 明确拒绝推进；
不能让旧消费方把 null 当已完成。
