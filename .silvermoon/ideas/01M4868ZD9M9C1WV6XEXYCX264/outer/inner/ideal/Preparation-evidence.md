# 准备阶段验证证据

服务于 [Idea.md](./Idea.md)，不声称 DAG 已实现、批准或性能已达标。

## 范围与环境

2026-10-06，在独立 worktree 的 `agents/silvermoon-idea-merkle-dag-update`
分支准备本 idea；起点为 `add6dd0d594c51e3ac3964e89cde230c86c5172c`，
upstream 为 `origin/main`。Windows、Node v24.12.0、pnpm v11.22.0。
创建前 staged/unstaged/untracked 均为空；fetch 后 fast-forward 检查无新提交。
首次源码 CLI 缺 commander，随后 `pnpm install --frozen-lockfile` 成功，
没有改变 manifest/lockfile 或添加发布的 silvermoon 自依赖。

## 操作与检查

以下均使用本 checkout 的源码入口。结果适用于准备候选，不是 V3 行为验证。

| 命令/检查 | 结果 |
| --- | --- |
| `node bin/silvermoon.js create-idea --audience agent` | 成功创建 `01M4868ZD9M9C1WV6XEXYCX264`，语言 zh-CN，preparing |
| `node bin/silvermoon.js event replay 01M4868ZD9M9C1WV6XEXYCX264 --audience agent` | 空事件前态有效，length=0，digest=`701ce17c37b5c6fa95f2c12ea97adc514c106425` |
| `git grep -n 'idea-event-merkle-dag' -- .silvermoon` | 创建时未发现占用 |
| 受控 `event append` setAlias，准确 length/digest/expected-primary，`--audience agent` | candidate-written，sequence=1，length=77，digest=`ed3c7536c45545674d9cff8f446eaeb8913a6788`；没有人类决定事件 |
| `pnpm check:sanity` | 通过；144 tests，0 fail，syntax/pure 同时通过 |
| `node bin/silvermoon.js check --worktree --audience agent` | 通过；完整候选 metadata/history 有效 |
| `node bin/silvermoon.js check --staged --audience agent` | 通过；仅 stage 本 idea 的契约、附件、占位、ledger 和 alias 事件 |
| `pnpm check:commit` | 通过；sanity、contract、markdown、skills-local、smoke、staged metadata、diff 检查通过 |
| `pnpm exec tsc --noEmit --strict --skipLibCheck --target ES2022 .silvermoon\ideas\01M4868ZD9M9C1WV6XEXYCX264\outer\inner\ideal\Event-types.ts` | 通过；仅候选类型，不是运行时 API |
| 使用既有 `mdast-util-from-markdown` 解析设计 Markdown、逐项检查相对 link 目标存在 | 通过；父 idea 背景与同世界附件可导航 |
| `git diff --check` 与 `git diff --cached --check` | 通过 |

## 证据限制

仓库 Markdown lint 配置排除 ideas，commit tier 的 lint 成功不代表这些契约已获
语义审查；本轮另验证本地 links 和候选类型。未改变 CLI/schema/模型运行时代码/
canonical skill，故本轮未执行 release-grade `pnpm check`；实施交付必须执行。
没有 V3 benchmark、迁移 apply、npm 发布、父 idea 修改或 acceptIdeal。
规模证据方案与未决 N/B 参数见 [Storage-validation.md](./Storage-validation.md)。
下游契约/ledger 未完成占位不代表已实施或已验收。

最终 primary commit 与准确 idealRevision 由提交/同步后的 `whats-next` 提供，
不在世界内自嵌 revision，避免修改世界导致自引用失效。提交后还须刷新 primary、
普通非 force 同步、确认 candidate 可达，再进入准确人类 gate。
