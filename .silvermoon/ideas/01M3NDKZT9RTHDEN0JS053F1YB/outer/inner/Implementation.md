# Implementation

## Steps

### I-S01: 建立 inventory query 模型

集中定义 active 与五种 canonical lifecycle states、规范化后的查询参数和结果
item/summary shape。实现可重复 state 的并集、`--all` 互斥、literal query、
RFC 3339 半开时间范围、ULID timestamp 解码、稳定 newest/oldest 排序和
post-sort limit；CLI 与直接 API 共享同一校验入口。

### I-S02: 提取可查询的 idea metadata

在完整 layout validation 之后，为每个 idea 读取 canonical ID、可选 alias、
lifecycle state、从 ULID 派生的 UTC `createdAt`，以及从 `Idea.md` Markdown
结构提取的可选第一个一级标题。保持现有 status schema 不变，缺失可选 metadata
不被伪造，也不阻止其他有效字段参与查询。

### I-S03: 增加无 repository readiness gate 的本地观察

新增面向 inventory 的 worktree snapshot observation：复用 Git root、配置、
canonical skill、idea layout 与 preferred language 检查，但不调用 worktree
hygiene、branch/upstream、fetch 或 ancestry 比较。保证过滤前先验证完整 layout，
并让 dirty、detached、无 upstream、ahead/behind/diverged 和离线 fixture 都能
查询同一份有效本地 snapshot。

### I-S04: 接入 CLI、API 与纯查询 renderer

注册 `list-ideas` 及 common `--root`、`--json`、`--trace`，再加入 state、all、
query、created-since/before、sort 和 limit options。输出只含
`intention`/`observation`；文本呈现筛选摘要、数量、截断事实和有序 items，
不复用 dialogue instructions。实现成功 `0`、unavailable `1`、usage `2` 的
明确退出行为。

### I-S05: 更新操作指南与自动化证据

在 README、getting started、operations、reference 和 canonical Silvermoon
skill 中区分“明确查看 inventory”与“判断下一步”，同步生成 skill 副本和 CLI
help。增加 query helper、renderer/CLI contract、worktree integration、无网络
断言、invalid layout、installed package 等测试，并运行完整 release-grade
检查。

## Acceptance criteria

### I-AC01: 默认查询准确列出 active ideas

无过滤参数的 API、Markdown 和 JSON 只返回 preparing、implementing、
deploying，排除 completed 与 abandoned；零项仍为 `ideas-listed` 且退出 `0`。
通过覆盖零、一个、多个及五种状态混合集合的 exact-shape tests 证明，并确认
默认排序为完整 ULID 的 newest-first 稳定顺序。

### I-AC02: 过滤、排序与 limit 可预测组合

重复 state/active 展开后取去重并集，其他 state、query 和时间范围取交集；
query 对 ID/alias/title 执行 case-insensitive literal substring，时间使用
ULID UTC instant 和 `[since, before)`，limit 在排序后应用且不改变 matched 或
counts。通过表驱动 unit/integration matrix 验证边界毫秒、同毫秒 ULID、
缺失 alias/title、空匹配、截断和 newest/oldest。

### I-AC03: 无效参数在 repository 访问前失败

未知/空 state、`--state` 与 `--all` 同用、空 query、非 RFC 3339 或无时区时间、
`since >= before`、未知 sort 及非正整数 limit 均以 usage exit `2` 拒绝。
通过 CLI spy 和直接 API 测试证明它们在 Git/filesystem observation、trace
创建或 remote access 前失败，且两种入口使用相同业务校验。

### I-AC04: inventory 不受 repository hygiene 与同步阻塞

有效 Silvermoon 项目在 dirty worktree、staged/untracked idea 变化、非 primary
或 detached branch、缺失 upstream、本地 ahead/behind/diverged 和禁止网络时
仍返回当前有效 worktree snapshot。通过 Git fixture 和 fetch/network spy
证明命令不检查 hygiene、不 fetch、不比较 ancestry，也不修改 worktree、
index、refs、配置或 status。

### I-AC05: 纯查询输出完整且不伪造

成功 JSON 恰好含 `intention` 与 `observation`，规范化参数、五态 counts、
matched/returned/truncated 以及有序 items 与文本一致；不存在 `outcomes`、
`instructions` 或 lifecycle 建议。alias 或标题缺失时，对应可选 key 与文本片段
均省略，不以其他字段冒充；empty 与 limited 结果都明确表达完整性。通过
renderer、CLI contract 和 installed-package E2E 的 exact-key/semantic
assertions 证明。

### I-AC06: 不可信项目或 layout 显式失败

缺失 Git、无效配置、canonical skill drift、缺失/无效 idea layout 或
malformed status 产生准确 problems 和退出 `1`，不返回部分 inventory 或成功
形状。无关 conflict 不阻塞；只有当其工作区内容使被读取的 Silvermoon 文件
无效时才按对应 validation problem 失败。通过 cumulative setup、无关 conflict
和逐类 layout failure fixtures 证明，筛选条件不能隐藏错误 idea。

### I-AC07: 既有命令与文档保持一致

`whats-next` 的 repository synchronization、候选和 lifecycle routing，
`create-idea` 的 preflight，以及全部 `check` target 均保持既有行为。CLI help、
README、operations/reference/getting-started 与 canonical/generated skill
清楚说明何时使用 `list-ideas`。`pnpm check`、`pnpm check:skills`、
package/installed E2E、Markdown links、`git diff --check`、Silvermoon
worktree/staged checks 全部通过。
