# 实现基于 Trace 的 CLI 性能优化

## Steps

### I-S01: 补齐可归因的测量边界

让 Silvermoon 启动的全部外部进程统一经过 trace-aware runner；为
CLI parse 后的 command dispatch、非交互 render 和 trace flush 建立明确
边界与安全 attributes。保留 interactive TUI 的人为等待边界，不把内容、
Git 参数或敏感环境写入 trace。

### I-S02: 合并 repository observation 与 readiness

建立单次命令的只读 observation context，复用 root、config、HEAD、
branch、upstream 和 snapshot identity。优先用一次 porcelain v2 status
取得 worktree / HEAD / branch 事实，并用一次有界 config 查询解析 upstream
repository；将固定 guidance lookup 合并进已有 batch object inspection。

### I-S03: 缩小 inventory metadata 读取

在保持完整 layout validation 的前提下，先用无需标题的 state、ULID time、
sort、limit 和 ID / alias 事实缩小候选；只为仍需 query 判断或最终返回的
ideas 读取并解析 `Idea.md` 标题。为候选数和实际 title reads 增加 trace
计数与回归测试。

### I-S04: 直接验证 immutable check snapshot

让 HEAD / commit / staged / worktree / remote target 复用一次解析出的
commit/tree，并通过批量 Git object reader 或有界 snapshot adapter 验证
repository 内容。删除 full-tree `checkout-index`；remote bootstrap 直接
读取 HEAD config，不先物化整个 repository。

### I-S05: 证明结果等价与性能改善

为 Git process budget、metadata reads、materialization、所有 check targets、
SHA-1 / SHA-256、并发变化和失败清理添加 focused tests。按 Ideal World
调研方法采集 before / after trace，运行 `pnpm check`，记录每个命令的
确定性指标与 5 次中位数。

## Acceptance criteria

### I-AC01: Trace 覆盖真实命令工作且保持安全

测试证明 Silvermoon 启动的每个外部进程都有父子 span，非交互 render
可单独归因，启动与 trace flush 边界有文档；trace schema、allowlist、
exclusive creation、错误传播和关闭 trace 时的结果保持不变。

### I-AC02: Inventory 只读取必要标题

包含 32 个 ideas、2 个 active ideas 的 fixture 证明默认 `list-ideas`
仍验证完整 layout，但 title read 从 32 次降至 2 次；`--all`、重复 state、
literal title / ID / alias query、creation bounds、sort、limit、summary
counts 与 JSON facts 的结果等价测试全部通过。

### I-AC03: Creation 与 navigation 合并本地 Git readiness

`repository.assess-creation-readiness` 和 `repository.assess-readiness`
在 clean aligned repository 中最多运行两个非网络 Git 子进程；
`whats-next` 仍只运行一个 network fetch 并使用该 fetch 的精确 commit。
dirty、conflicted、detached、upstream mismatch、behind、ahead、diverged
和 shallow history diagnostics 保持顺序与内容语义。

### I-AC04: Check 不再完整物化 repository

HEAD / commit / staged / worktree validation 不运行 full-tree
`checkout-index`；remote bootstrap 不运行 `snapshot.materialize`，fetched
primary 也只读取验证所需的有界内容。所有 target 对同一 tree 得到与基线
相同的 diagnostics、world revisions 和退出码，临时资源无残留。

### I-AC05: 相对性能目标通过

同一机器、同一 checkout、一次 warm-up 后各 5 次 trace 的中位数证明：
默认 `list-ideas` 至少降低 15%，`create-idea` 与 aligned `whats-next`
扣除 network fetch 后至少降低 20%，HEAD / staged / worktree `check`
至少降低 30%，remote `check` 扣除 network fetch 后至少降低 35%。
报告同时列出全部样本，不以网络、cache 或异常值选择替代中位数。

### I-AC06: 完整兼容性验证通过

Targeted unit / integration tests、`git diff --check` 和 `pnpm check`
全部通过；package API、CLI help、四投影 schema、language / audience、
trace filename、snapshot side-effect boundary 与 installed-package
行为没有回归。
