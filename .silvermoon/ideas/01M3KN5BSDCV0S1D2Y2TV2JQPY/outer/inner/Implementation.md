# Implementation

## Steps

### I-S01: 拆分就绪后的对话 observation

保留项目和仓库整备观察的共享构建逻辑以及 `check` 独立结果；
为裸导航、匹配/未匹配 selector 和创建成功/失败生成各自的判别状态与专属字段。
成功创建时从已验证的写入结果生成 `createdIdea`，不声称创建后工作区干净。

### I-S02: 按结果视图渲染简洁文本

指定 idea 的项目现状只呈现就绪、目标身份及 lifecycle 状态；未知 selector
保留候选列表。成功 fetch 在 HEAD 与本次 primary 对齐时只从文本隐藏，
JSON outcome 不变。失败与需要同步时不隐藏操作结果。

### I-S03: 同步公开契约与验证

同步 skill、参考文档和现有单元/契约/集成/安装包测试；
覆盖四种意图、终态 idea、空导航、未匹配 selector、创建失败、
副作用记录与文本省略边界，执行仓库要求的完整验证。

## Acceptance criteria

### I-AC01: 四种意图各有可靠 observation

`check` 仍只有 intention/observation；两个对话命令仍使用通用
outcomes/instructions 结构，就绪结果按意图区分字段且整备失败不误报成功。
通过契约与集成测试检查精确 JSON 键、生命周期状态、创建成功和失败分支。

### I-AC02: 简洁文本不损失关键事实

选中 idea 的文本包含状态而不复制全局列表；例行成功 fetch 在对齐时
只从文本消失，JSON 仍记录，失败和同步问题仍可见。
通过双语单元测试、集成场景和安装包 e2e 对照文本与 JSON 验证。

### I-AC03: 发布候选完整可验证

参考文档、skill 与实现一致；`pnpm check`、`git diff --check`、
`silvermoon check --worktree` 和 `--staged` 通过，并将结果记录在 ledger。
