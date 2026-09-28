# Implementation

## Steps

### I-S01: Normalize trace output names

在公共 CLI option parser 中将 `--trace` 参数规范为精确的小写
`.trace.jsonl` suffix，已匹配时保持不变，未匹配时直接追加。更新 help、README、
reference 与 integration tests，并在 repository `.gitignore` 中只忽略
`*.trace.jsonl`，不扩大到任意 JSONL。

### I-S02: Snapshot idea worlds once

让 worktree observation 用一个临时 index 只 snapshot `.silvermoon/ideas` 一次，
而 staged、commit 与 remote 继续复用调用者已经 materialize 的 immutable tree。
收集所有有效 idea 的三个固定 world paths，通过一个 `git cat-file --batch-check`
调用解析并验证 tree object，删除逐 world 的临时 index helper。

### I-S03: Observe primary through one fetch

让 primary branch 的 fetch 使用 machine-readable output 返回本次连接取得的精确
commit，删除预先 `ls-remote` 与重复移动重试。继续验证 fetched object 是 commit，
不更新 branch、remote-tracking ref、index 或 worktree，并保留 fetch failure 的
具体错误与现有 dialogue outcome。

### I-S04: Prove equivalence and performance

增加固定 14-idea command-count fixture、snapshot target 回归、single-fetch
观察与 trace filename cases。使用当前 16-idea repository 在同一机器重新采集
优化后 trace，与 snapshot-only 基线比较，最后运行完整 `pnpm check`。

## Acceptance criteria

### I-AC01: Trace files follow one ignored naming convention

三个公共命令对 missing suffix、already-matching suffix、相对路径与绝对路径都生成
唯一的 `.trace.jsonl` 目标；exclusive creation 仍拒绝覆盖。CLI help 与文档展示该
suffix，`git check-ignore --no-index` 证明 nested `*.trace.jsonl` 被忽略而普通
`.jsonl` 不被忽略。

### I-AC02: Idea layout uses a constant Git process budget

无论 fixture 包含 1 或 14 个 ideas，worktree `idea-layout.inspect` 最多运行四个
Git 子进程：一次 `read-tree`、一次 scoped `add`、一次 `write-tree` 和一次 batch
`cat-file`；已有 immutable snapshot 时只运行 batch lookup。集成测试同时证明三个
world revisions、级联关系、diagnostics 与 lifecycle 保持不变。

### I-AC03: Primary observation uses one network command

一次 readiness 或 remote check 只执行一个 network Git command `fetch`，不执行
`ls-remote`；返回 commit 等于该 fetch 的 machine-readable result，对应 object
存在且为 commit，调用前后 named refs 保持相同。以 Git command observer 和真实
local bare remote integration tests 证明。

### I-AC04: Measured latency and compatibility targets pass

当前 snapshot-only 基线为 16 ideas、layout 241 个 Git 子进程、
`idea-layout.inspect` 26232.359ms。优化后同 repository、同机器、可比状态下 layout
不超过四个 Git 子进程且 duration 至少下降 80%。所有 targeted tests 与
`pnpm check` 必须通过，SHA-1/SHA-256 object ID shape、所有 check targets、
temporary cleanup 和 fail-closed behavior 不得回归。
