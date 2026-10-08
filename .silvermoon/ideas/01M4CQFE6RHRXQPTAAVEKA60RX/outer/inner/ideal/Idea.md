# V2 idea 事件单文件日志

## 意图

将每个 V2 idea 的规范事件存储从分段 `events/` folder 简化为 idea 根目录下的
单个 `events.jsonl`。idea 不再承担长期日常会话，事件历史规模有限；单文件应在
保留准确前态绑定、追加幂等、生命周期决定和可恢复事务的同时，消除分段模型带来的
额外复杂度。

## 背景

当前 V2 为每个 idea 建立 `events/` folder，并以最多 1000 条记录的连续 JSONL
segment 保存一条逻辑事件流。folder tree digest、segment 命名与边界、封存段复用、
跨段事务和 segment-aware cache 都源于“事件历史会持续长期增长”的假设。

现在的架构边界已经变化：长期日常上下文由不绑定 idea 的 general session 承载；
idea session 只服务一个有明确准备、实施、部署和完成边界的目标；完整 transcript
也不会复制进 Git。idea 的规范事件只记录少量 metadata、生命周期决定和必要的
交互消息，不再是 long-lasting session 的无限历史。因此，分段带来的文件数量、
多文件原子性、tree digest 和恢复分支，已经超过实际数据规模所需。

`segmented-event-stream`（`01M3Y5QQ2ATPT8XWH3RCPZTHT8`）建立了当前分段基线；
已放弃的 `idea-event-merkle-dag`（`01M4868ZD9M9C1WV6XEXYCX264`）探索了更复杂的
事件拓扑。本 idea 不恢复 Merkle DAG，而是在现有线性事件语义上撤销不再必要的
物理分段。

## 期望结果

### O-01: 每个 V2 idea 只有一个规范事件文件

每个 V2 idea 根目录必须且只能包含一个规范事件日志 `events.jsonl`；不再创建
`events/` folder、序号 segment 或空尾段。新 idea 以零字节 `events.jsonl`
表示尚无事件的有效初始状态。

文件继续使用无 BOM 的 UTF-8、LF 换行，并在非空时以 LF 结束。每条记录仍是单行
canonical JSON，`sequence` 从 1 开始连续递增，既有事件类型、payload、归约结果、
生命周期规则和单条记录大小限制均不因存储简化而改变。日期、进程重启和 Agent
session 边界都不会切换文件或重置 sequence。

正常 V2 snapshot 中，`events.jsonl` 与旧 `events/` folder 同时存在、缺少两者、
或出现非规范替代文件都必须显式报错，不能猜测优先级或静默补建。

### O-02: HEAD 和 cursor 绑定整个文件

事件流 `digest` 使用完整 `events.jsonl` 原始字节对应的 Git blob OID，并遵循
仓库的 SHA-1 或 SHA-256 object format；`length` 是同一原始字节流的准确字节数。
事件 HEAD 仍由 `{ length, digest }` 表示，不得以 repository commit、最后一个
sequence、文件 mtime、缓存摘要或尾部内容替代。

完整 replay 必须验证整份日志和归约结果。增量 replay 继续要求调用方同时提供准确
的 `after-length` 与 `after-digest`，证明调用方已经处理过同一文件前缀后才返回
后续完整记录。历史前缀被修改、删除、截短，cursor 落在记录中间，或 digest 与
长度不匹配时都应明确失败，不自动重置 cursor 或返回成功形状的全量结果。

Git snapshot 可以直接使用已验证 blob OID；worktree、index 和事务候选必须从其
准确字节计算同一 OID。派生 cache 可以加速读取，但不能成为事件事实、授权来源或
绕过完整验证的理由。

### O-03: 单文件追加仍然准确、原子且可恢复

metadata、生命周期决定和 ping/pong 继续通过受控 `event append` 写入，不允许
普通路径手写 JSONL。写入必须绑定观察到的准确 `{ length, digest }`，需要 primary
前提的请求继续绑定准确 primary commit，并在取得项目级互斥后重新验证来源与候选。

实现以完整候选文件的可恢复事务提供单一提交点。任何成功 receipt 都只能在规范文件
完整可见且重新验证通过后返回；中断恢复必须能区分并恢复准确原始文件或准确候选文件，
不能依靠锁文件年龄、部分尾部或成功形状默认值猜测结果。锁、临时文件、authenticated
projection、cursor 和 checkpoint 均不属于规范日志，也不得提交。

`candidate-written`、`already-present`、`no-state-change` 和冲突语义保持可区分。
重试只有在原始前缀之后存在请求对应的准确记录时才能报告 `already-present`；
另一个请求占用了同一前态时必须拒绝 stale 请求，不能自动刷新、覆盖或重编号。
移除 segment 后不应保留 segment table、封存段、跨段切换或空尾段等无效分支。

### O-04: 现有分段 V2 历史显式、等价地迁移

项目 schema 保持 `version: 2`，不为这次尚未发布的内部布局修订引入 V3。已有
分段 V2 idea 必须通过显式授权的一次性迁移，将所有规范 segment 按序逐字节连接为
一个 `events.jsonl`；迁移前后的事件记录、顺序、sequence、payload、归约状态、
交互消息和生命周期决定必须完全等价。

迁移需要可审阅的计划摘要、准确来源 digest、干净且已提交的来源、可恢复事务、
重复调用幂等检测和普通非强制 Git 集成。来源、primary、候选或未知文件发生变化时
必须阻挡，不能覆盖并发工作。迁移完成后正常命令只接受单文件布局；历史检查仍须识别
准确的分段到单文件 format boundary，并证明边界两侧逻辑事件流等价，而不是要求
旧 commit 被改写。

现有 V1 `status.yaml` 支持与 V1 到 V2 的显式迁移语义保持不变，但新的 V2 候选
必须直接生成 `events.jsonl`。不得隐式迁移外部 checkout，也不得同时长期维护两套
当前 V2 写入格式。

### O-05: 所有相关表面采用同一单文件契约

创建脚手架、schema/layout 校验、replay、delta cursor、append、历史比较、
transaction recovery、primary 集成、runtime/SDK 边界、公开与内部类型、
`.gitattributes`、文档、canonical skill、注册 skill 和迁移工具必须一致使用
`events.jsonl`。`.gitattributes` 必须对 `**/events.jsonl` 禁用文本转换和 filter，
保证工作树、index、Git object 与不同平台读取相同字节。

测试必须覆盖空日志、首次追加、多次追加、单条大小边界、cursor 边界、stale 并发、
丢失 receipt 后重试、损坏/截短文件、中断恢复、SHA-1/SHA-256、Windows/POSIX、
worktree/index/commit/remote snapshot，以及分段来源到单文件候选的等价迁移。
验证应证明删除分段专用逻辑后行为仍然完整，而不只把 fixture 路径改名。

## 范围

### 范围内

- 将 V2 idea 的规范布局从 `events/` folder 改为根目录 `events.jsonl`。
- 统一完整 replay、增量 cursor、append、事务、历史验证和 Git digest 语义。
- 删除 segment 命名、固定条数边界、封存段、segment table 和跨段事务分支。
- 提供本仓库现有分段 V2 数据的一次性显式迁移、恢复和逻辑等价验证。
- 更新脚手架、schema、类型、测试、文档、skill、`.gitattributes` 与 package 内容。
- 保持 V1 支持和既有事件业务语义的回归验证。

### 范围外

- 改变事件类型、payload、sequence、归约、alias/language 或生命周期决定语义。
- 引入 Merkle DAG、双链、每事件一个文件、数据库或新的 session/transcript 存储。
- 把 general session transcript、完整 Agent trace 或任意观察写入 idea 事件日志。
- 自动重试 stale 意图、自动推断人类决定、改变 daemon/SDK 消息路由协议。
- 重写既有 Git 历史、隐式迁移外部仓库、降级回分段格式或在本 idea 中发布 npm。
- 以当前规模假设为由降低单条记录验证、并发保护、错误传播或恢复完整性。

## 约束

- 事件日志仍是唯一业务事实来源；cache、cursor、transaction metadata 和 Agent
  transcript 都只是派生或操作状态。
- 单文件简化不能把“数据量较小”解释为允许非原子写入、部分成功、静默截断或宽松解析。
- 所有输入、文件系统、Git 和恢复错误都必须返回显式诊断，不能用空日志或旧状态兜底。
- 迁移不创造事件、不改变批准 revision，不把创建或同步候选解释为人类决定。
- 实施必须保留未知工作，使用普通非强制 Git 集成，并通过 change-specific tests、
  `pnpm check:sanity`、`pnpm check:commit` 与 release-grade `pnpm check`。
- 本次只准备 Ideal World；Implementation、Deployment 与 ledger 保持同步占位，
  直到准确 `idealRevision` 获得明确批准。
