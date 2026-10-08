# 单文件事件日志实施证据

本文档服务于 [Implementation](./Implementation.md)，记录 repository candidate 的
可复核事实，不构成额外契约或人工验收。最终 `implementationRevision` 由候选同步到
primary 后的 `whats-next` report 提供；world tree 不记录自己的 revision，避免内容
寻址自引用。

## Candidate identity

- Idea: `single-event-log`
- ULID: `01M4CQFE6RHRXQPTAAVEKA60RX`
- Schema version: `.silvermoon/config.yaml` 保持 `version: 2`
- Implementation contract commit:
  `cec0d1c8558f7206b797da93af04529ae41ad2d8`
- One-time migration implementation commit:
  `61669759fc7e6965f91b7934154482bc96cbd1f7`
- Repository data migration commit:
  `392d662d8897f5ebb1a88bf93e9609087bbf65d9`
- Migration plan digest:
  `0f03411caff3ea4b1cfc7910455033da2687554345b63aea9d2256322a143183`

## 一次性迁移

源仓库专用工具
[migrate-v2-events-to-single-file.ts](../../../../../tools/migrate-v2-events-to-single-file.ts)
先在已提交且干净的 `61669759fc7e6965f91b7934154482bc96cbd1f7`
source/primary 上生成绑定 digest 的 read-only plan，再通过 recoverable transaction
应用该计划：

- 识别并迁移当时仓库内全部 45 个 V2 ideas；
- 按规范 ordinal 顺序逐字节连接每个 idea 的旧 segment，生成根目录
  `events.jsonl`，不重新序列化 event bytes；
- 验证迁移前后 event count、连续 sequence、归约状态与 lifecycle decisions 等价；
- 只删除计划中 operation-owned 的 segment files 及已清空的 `events/` 目录；
- 保持 `.silvermoon/config.yaml` 的 `version: 2` 不变；
- 迁移后再次 plan 返回 `already-single-file`，证明重复执行幂等；
- 数据迁移由 commit `392d662d8897f5ebb1a88bf93e9609087bbf65d9`
  同步到 primary，正常 runtime 不保留旧分段布局的读取分支。

[migrate-v2-single-file.test.ts](../../../../../test/runtime/migrate-v2-single-file.test.ts)
覆盖 plan digest、未知/未提交来源阻挡、准确字节连接、幂等以及 apply 中断后的
resume/rollback。迁移工具位于 `tools/`，不在 npm package allowlist 内。

## Stable-ID evidence

| Stable ID | Repository evidence | Verification | 状态 |
| --- | --- | --- | --- |
| `I-S01` / `I-AC01` | [layout.ts](../../../../../src/foundation/coordinates/layout.ts)、[storage.ts](../../../../../src/foundation/event-store/storage.ts) 与 [digest.ts](../../../../../src/foundation/event-store/digest.ts) 只表示根目录 regular file `events.jsonl`；空文件合法，digest 是完整原始字节的 Git blob OID | unit/runtime/integration tests 覆盖空文件、布局拒绝、SHA-1/SHA-256 与 1 MiB record 上限 | 通过 |
| `I-S02` / `I-AC02` | [cursor.ts](../../../../../src/foundation/event-cursor/cursor.ts)、[projection.ts](../../../../../src/foundation/projection-cache/projection.ts)、[history.ts](../../../../../src/foundation/event-history/history.ts) 与 [policy.ts](../../../../../src/foundation/event-reducer/policy.ts) 统一读取或原子替换同一个文件 | [incremental-append.test.ts](../../../../../test/integration/incremental-append.test.ts) 覆盖准确 CAS、重试、stale、cursor、history、cache authentication 与 recovery | 通过 |
| `I-S03` / `I-AC03` | 一次性工具与 transaction directory-removal recovery 绑定准确 plan/source/primary bytes；正常 runtime 不理解旧 segments | [migrate-v2-single-file.test.ts](../../../../../test/runtime/migrate-v2-single-file.test.ts) 与 45-idea committed migration；schema 仍为 V2 | 通过 |
| `I-S04` / `I-AC04` | scaffold、V1→V2 migration、schema、`.gitattributes`、README、docs、canonical/registered skill 与 package inputs 均改为 `events.jsonl` | skill checks、contract/integration tests、Silvermoon worktree check；`pnpm sync:skills` 后两份 skill 一致 | 通过 |
| `I-S05` | 删除只证明 segment boundary 的 runtime test，新增 [single-file-events.test.ts](../../../../../test/runtime/single-file-events.test.ts)，并重写 event store 与 incremental append suites | 单文件正常、失败、并发、receipt-loss、tampering、history 与跨 object format 回归均进入标准 suites | 通过 |

## 实施细节

- [storage.ts](../../../../../src/foundation/event-store/storage.ts) 将 stream snapshot
  定义为单个 file bytes、准确 length 与 blob OID，不再公开 segment ordinal、
  sealed segment 或 folder tree digest。
- append 根据已验证前态构造完整 candidate file，通过既有 recoverable transaction
  原子替换 `events.jsonl`；`{ length, digest }` CAS、human gate、receipt-loss
  `already-present` 与 stale-prefix 拒绝保持不变。
- cursor 仍返回 suffix，但完整 authority 会被验证；prefix 必须落在 canonical
  record boundary，prefix blob digest 必须匹配，合并后的 sequence 必须连续。
- projection cache 继续是非权威 Git-private cache；认证 context 绑定 runtime source
  identity、idea ID 与完整 file blob OID。损坏、认证失败或 canonical bytes 不匹配均
  显式报错，不退化成成功形状。
- Windows Git snapshot 的 source fingerprint 校验只容忍 ctime-only 漂移，并且仅在
  当前 Git-filtered blob 仍与临时 index blob OID 完全相同时接受。内容或其他 metadata
  变化仍显式失败。
- 历史 `legacy` / `final` 名称仅表示旧 dotted event type 的既有迁移语义，不是旧
  segment storage 兼容。

## 已完成验证

| 命令 | 结果 | 关键证据 |
| --- | --- | --- |
| `pnpm test:unit` | exit 0 | 单文件 digest、canonical JSONL、cursor 与 transaction 单元回归通过 |
| `pnpm test:integration` | exit 0 | 151 tests：146 passed、5 skipped、0 failed；包含真实 CLI/Git、SHA-1/SHA-256、history、projection tampering 与 Windows snapshot 回归 |
| `pnpm check:sanity` | exit 0 | TypeScript build、基础 lint/tests 与 package sanity 通过 |
| `pnpm check:skills:local` | exit 0 | canonical 与 registered local skill 内容通过检查 |
| `pnpm check:skills` | exit 0 | skill frontmatter、结构与分发检查通过 |
| `node bin\silvermoon.js check --worktree --audience agent` | exit 0 | 基于 `392d662d8897f5ebb1a88bf93e9609087bbf65d9` primary baseline 的完整 worktree snapshot 有效 |

## 最终 gate

包含 runtime、tests、docs、skills、package allowlist、本证据和 ledger 的 staged
candidate 已完成第一次完整 gate：

| 命令 | 结果 | 关键证据 |
| --- | --- | --- |
| `git diff --cached --check` | exit 0 | staged candidate 无 whitespace error |
| `node bin\silvermoon.js check --staged --audience agent` | exit 0 | 基于 `392d662d8897f5ebb1a88bf93e9609087bbf65d9` primary baseline 的 staged snapshot 有效 |
| `pnpm check:commit` | exit 0 | commit-tier checks 全部通过；`CHECK_TOTAL 14797ms` |
| `pnpm check` | exit 0 | typecheck/build/pure/skills/quick 全部通过；Markdown 0 issues；pack 503 files；integration 146 passed + 5 platform skips；installed-package E2E 1/1；`CHECK_TOTAL 204965ms` |

第一次 release run 发现并显式修复了两个直接分发表面：package allowlist 不再要求
已删除的 `event-store/stream` 构建产物，installed-package E2E 改为读取
`events.jsonl`。修复后先定向通过 `pnpm pack:check:built` 与
`pnpm test:e2e:built`，再由上表完整 `pnpm check` 覆盖。

本节与 ledger 更新后，将对更新后的 exact final candidate 重跑 staged check、
`pnpm check:commit` 和 release-grade `pnpm check`。通过后同步到 primary，并请求
准确 `implementationRevision` 的 acceptInner。
