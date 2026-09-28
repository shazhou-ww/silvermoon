# Implementation

## Steps

### I-S01: Simplify snapshot target orchestration

让 HEAD、commit、staged、worktree 与 remote target 都只 materialize 其精确 tree，
并向 observation 传递 snapshot 本身需要的输入。删除 first-parent lookup、
base/history/candidate 参数以及不再被 snapshot 构造消费的 changed-path helper，
同时保留 remote bootstrap、fetch 和所有 fail-closed 错误路径。

### I-S02: Derive lifecycle only from snapshot facts

让 idea layout 继续验证 canonical status、固定目录、regular file、symlink、ULID、
alias、Git object format 与三个当前 world tree，并仅用 status facts 和当前 world
revisions 派生 lifecycle。停止要求旧 decision revision 在 object database 中存在、
可达或能从 Git 历史重建，也不再从 parent diff 推断本次 decision。

### I-S03: Cover topology-independent target behavior

增加集成回归，构造相同 tree 的 single-parent commit 与两种 parent 顺序的 merge，
并通过 HEAD、commit、staged、worktree 和 remote target 比较项目结果；同时观察 Git
命令，确保普通 check 不执行 first-parent、status diff、decision history 或旧
revision object 查询。

### I-S04: Align operator documentation

更新 reference 与 operations，明确普通 check 是 snapshot validator；精确 revision
的人类授权、status-only publication 与并发保护属于 workflow，decision provenance
若未来需要审计，应由独立能力承担。

## Acceptance criteria

### I-AC01: Equivalent trees produce equivalent project results

相同 materialized tree 经 single-parent、不同 parent 顺序的 merge、HEAD、commit、
staged、worktree 与 remote 检查时，必须得到相同 state、idea inventory 和 findings。
以 `test/integration/check-v1.test.js` 中的 target-equivalence 回归证明，并单独覆盖
root commit 可检查。

### I-AC02: Historical revision facts need no retained object

形状 canonical 但不等于当前 world 的 decision revision 必须作为合法历史事实保留，
即使本 clone 中不存在对应 object，也只通过 lifecycle comparison 使 idea 回到较早
阶段。以 `test/integration/idea-layout.test.js` 的 preparing、implementing 与
deploying cases，以及 check target 回归中的 missing object ID 证明。

### I-AC03: Ordinary checks do not inspect transitions or provenance

所有 check targets 都不得为项目有效性执行 `<commit>^1`、读取 parent status、
`git log -S` 或查询旧 decision revision 的 object type。以
`observeGitCommands` 捕获真实命令并对这些命令形状作否定断言。

### I-AC04: Existing snapshot validation remains compatible

配置、canonical skill、layout、world tree、lifecycle、target resolution 与
fail-closed exit semantics 必须保持通过，且文档准确描述新的责任边界。以相关
integration tests 和完整 `pnpm check` 证明。
