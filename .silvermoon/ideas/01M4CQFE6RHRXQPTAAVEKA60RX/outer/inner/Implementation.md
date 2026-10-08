# Implementation

## Steps

### I-S01: 收敛唯一单文件存储模型

将 V2 idea 的规范坐标统一为根目录 `events.jsonl`，删除运行时中的
`eventsDirectory`、segment ordinal、固定条数边界、folder tree digest 与
single-file legacy 分支。事件 store 只表示一个已验证的 regular file；空文件是
合法初始日志，完整原始字节的 Git blob OID 是 stream digest，准确字节数是 length。
保留 canonical JSONL、连续 sequence、单记录 1 MiB 上限和仓库 SHA-1/SHA-256
object format。

### I-S02: 改造读取、追加、cursor 与历史验证

让 idea layout、snapshot、replay、delta cursor、projection、受控 append、
transaction recovery 和 primary history comparison 都读取同一个 `events.jsonl`。
追加构造完整候选文件并通过现有 recoverable transaction 原子替换；前态继续绑定
`{ length, digest }`，准确重试、stale 拒绝、human gate 与 receipt 语义保持不变。
删除跨段读取、sealed segment、segment table 和 folder snapshot 快路径，但保留
经过文件 blob OID 绑定的安全增量读取与非权威 projection cache。

### I-S03: 提供一次性分段 V2 迁移

新增仅供 Silvermoon 源仓库使用的一次性迁移入口。read-only plan 校验干净、已提交
且完整的分段来源，按规范 ordinal 顺序连接 segment，报告准确来源/候选 digest 与
逻辑归约等价；apply 绑定 plan digest，通过 recoverable transaction 写入
`events.jsonl` 并删除准确的 operation-owned segments。中断恢复只恢复或完成计划中
记录的准确字节。迁移不升级 `.silvermoon/config.yaml` 的 `version: 2`，不成为公开
CLI，也不在正常 runtime 中保留双格式读写兼容。

### I-S04: 迁移本仓库并统一所有公开表面

使用一次性工具迁移本仓库全部现有 V2 idea，保持每条事件、决定和归约状态等价。
更新 schema/layout、脚手架、`.gitattributes`、类型、错误文案、README、docs、
canonical skill、registered skill、npm 生成输入和 package 内容，使示例与操作说明
只描述 `events.jsonl`。V1 `status.yaml` 及 V1 到 V2 迁移继续受支持，但新 V2
候选直接创建单文件。

### I-S05: 重写分段专项测试并补齐回归矩阵

将 fixture 与断言改为单文件 authority，删除只证明 segment 边界的测试，新增空文件、
首次/连续追加、blob digest、cursor 前缀、stale 并发、receipt 丢失重试、截短/损坏、
transaction recovery、Git snapshot/history、SHA-1/SHA-256 和 Windows/POSIX 路径
覆盖。迁移测试必须证明所有来源 segment 按序连接、归约逐项等价、未知修改阻挡、
重复 apply 幂等且失败不会留下成功形状。

### I-S06: 完成发布级验证与实施证据

依次运行 change-specific unit/runtime/integration/contract tests、`pnpm check:sanity`、
`pnpm check:skills:local`、`pnpm check:commit` 和 release-grade `pnpm check`。
记录准确命令与结果，检查 package 内容、Markdown links、Git diff、迁移后仓库 snapshot
和 primary history；只在全部证据有效且 ledger 同步后请求准确
`implementationRevision` 的 acceptInner。

## Acceptance criteria

### I-AC01: V2 当前布局只有 events.jsonl

创建、读取和校验任一 V2 idea 时，唯一 authority 是根目录 regular file
`events.jsonl`；`events/`、混合布局、缺失文件和 symlink 均得到明确诊断。空日志和
非空日志的 digest 分别等于其准确原始字节的 Git blob OID。通过 schema contract、
scaffold integration 与 SHA-1/SHA-256 digest tests 证明。

### I-AC02: 单文件操作保持既有事件正确性

replay、delta cursor、metadata/decision append、ping/pong、projection cache、
history checks 和 recovery 在单文件上保持连续 sequence、准确 human gate、原前缀
幂等与 stale 拒绝；损坏、截短或中断不返回成功形状。通过 unit、runtime 与真实 Git
integration tests 覆盖正常、重试、并发和失败路径。

### I-AC03: 一次性迁移完整且不改变 schema 版本

迁移 plan/apply/recovery 对当前仓库全部分段 V2 idea 产生单文件候选，逐字节连接结果、
事件数、归约状态和 lifecycle decisions 与来源一致；配置仍为 `version: 2`，迁移后
没有 segment 或正常 runtime 双格式分支。通过迁移 fixture、迁移前后机器可读摘要、
`silvermoon check --worktree` 与 committed primary history 证明。

### I-AC04: 仓库、文档与分发内容一致

源代码、schema、类型、测试、`.gitattributes`、docs、README、canonical/registered
skill 和 npm package 只把 `events.jsonl` 描述为 V2 当前布局；V1 行为仍通过回归。
通过 targeted search、skill checks、contract tests、Markdown lint 和 pack check
证明，不把历史 idea 契约中的原始讨论误当作当前文档修改。

### I-AC05: 发布级检查全部通过

`pnpm check` 在迁移后的干净候选上成功，且 `git diff --check`、Silvermoon worktree/
staged checks 与 package validation 无失败。实施证据列出实际命令、结果和必要的环境
边界，不以未运行、跳过或成功形状 fallback 代替证明。
