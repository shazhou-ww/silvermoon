# 让 check 成为与父历史无关的 snapshot 验证器

## Intent

让 `silvermoon check` 只验证调用者指定 snapshot 的内在项目契约，使相同 snapshot
无论通过普通 commit、merge、cherry-pick、staged index 或 worktree candidate
抵达，都得到相同的项目检查结论。

## Context

当前 `check --commit` 会把 `<commit>^1` 作为 `baseRevision`，再把相对第一父提交
变化的 status decision 当成本 commit 新作出的决定，并要求它等于当前 world
revision。这实际验证的是从第一父提交到目标 commit 的 transition，而不是文档所称
的单一 snapshot。

一次真实 merge 暴露了该问题：第一父提交没有后续 implementation/deployment
acceptance，第二父提交包含已通过校验的历史 acceptance；merge 正确保留第二父提交
的 status 与 world 内容，却因只比较第一父提交而报告
`idea.revision.candidate-mismatch`。两个父提交分别检查均有效，merge tree 相对
primary 也只增加无关功能文件，因此该 finding 是由 parent order 产生的误报。

Silvermoon 当前 lifecycle 已完全由 status 中的 decision revision 与 snapshot
计算出的三个嵌套 world revision 按顺序比较而得。修改 Ideal、Inner 或 Outer World
会自然级联改变 revision，并分别回到 preparing、implementing 或 deploying；无需再
用“当前阶段只能修改哪些路径”或“本 commit 新改了哪个 decision 字段”约束状态转换。

## Desired outcome

- `check` 的项目有效性只取决于 materialized snapshot 及其当前项目契约，不取决于
  commit parent、parent 顺序、branch、抵达 snapshot 的操作或完整历史。
- lifecycle 只由当前 world revisions 与 status facts 的相等关系派生；不相等的旧
  approval/acceptance revision 是合法历史事实，并自然使 idea 回到对应阶段。
- 普通项目检查不推断一次调用中是否“新写入”了 decision，也不限制 preparing、
  implementing 或 deploying 阶段可以修改哪些文件。
- `check --remote` 仍 fetch 并验证精确 primary snapshot，但不再把完整 acceptance
  history proof 混入常规项目有效性。
- `check` 的所有 targets 对同一个 snapshot tree 给出一致的 idea state 与 findings；
  merge commit 不因 acceptance 来自非第一父提交而误报。

## Scope

### In scope

- 删除 `baseRevision`、`validateCandidate`、first-parent lookup 和
  `validateCandidateRevisions` 这条 transition-validation 数据流。
- 删除常规 snapshot 检查中的 acceptance history 搜索；`git log -S`、历史
  evidence commit 和 retained decision reachability 不再是 `project-ready` 前提。
- 清理已经没有生产用途的 changed-path/阶段范围 helper 与陈旧文档表述。
- 保留并强化以当前 snapshot 为输入的配置、skill、目录、canonical YAML、ULID、
  alias、symlink、world entry、world revision 和 lifecycle 检查。
- 增加 root、single-parent、merge、不同 parent order、staged、worktree、commit
  与 remote target 的等价性和回归测试。
- 记录普通 `check` 不会执行 parent diff、`git show <parent>:status` 或
  `git log -S` 的命令观察测试。

### Out of scope

- 不在本 idea 优化 Git 子进程批处理、primary fetch 往返或整体响应时间；这些由
  `git-observation-performance` idea 处理。
- 不新增 status mutation 命令，也不让 Silvermoon 从 Git 操作、字段变化或静默中
  推断人类批准与验收。
- 不改变 `whats-next` 的 repository readiness、同步、导航和发布保护流程。
- 不在普通 `check` 中保留一个弱化版历史审计；若未来确需审计 decision provenance，
  应作为名称、输出和成本都明确的独立能力另行设计。

## Constraints

- `check` 仍须 fail closed：snapshot 无法解析或 materialize，以及 snapshot 内在
  schema/layout 契约无效时返回退出码 1；CLI 用法错误返回 2。
- `check --staged` 仍是 pre-commit target，`check --worktree` 仍检查完整候选，
  但 HEAD 只用于构造候选 snapshot，不用于裁定 transition 是否允许。
- status revision 字段继续要求 canonical object ID 形状。旧 revision 与当前 world
  不相等是正常状态，不要求其对象仍存在、可达或能从当前 clone 的历史中证明；当字段
  等于当前 world revision 时，当前 world tree 本身已提供绑定事实。
- 人类 decision 的授权边界继续由显式对话、skill 和普通 Git publication 流程保证；
  snapshot validator 不伪称能从 diff 证明人的意图。
- 不削弱与 transition 无关的安全检查，也不以成功形状掩盖 I/O、Git object format
  或 snapshot materialization 错误。
