# Implementation

## Steps

### I-S01: 拆分 create-idea readiness

从现有共享 readiness 中提取可复用的 project、branch/upstream、worktree 和
remote synchronization 观察原语。为 `create-idea` 组合只含项目整备、
primary branch/upstream identity 与 clean worktree 的本地 preflight；
保留 `whats-next` 的 fetch 和 ancestry 行为不变。

### I-S02: 建立 create 专属报告与渲染

按项目未整备、本地仓库未整备、创建成功和创建失败生成意图专属
observation。移除 create 报告中的 inventory 和远端事实，统一“交互语言”
术语，精简 scaffold outcome 与成功后的紧邻建议，并保持中英文及 JSON/文本
由同一结构化事实驱动。

### I-S03: 同步公开契约与回归验证

更新 canonical skill、reference、operations、getting-started 与相关测试。
覆盖 project block、branch/upstream block、四类 worktree change、本地
ahead/behind/diverged 不阻塞、零 remote call、创建成功及部分写入失败，
并运行仓库规定的完整验证。

## Acceptance criteria

### I-AC01: create 仅检查必要的本地安全条件

集成测试证明正确 primary branch/upstream 且 worktree clean 时，本地 HEAD
无论与模拟 remote 为 equal、ahead、behind 或 diverged 都可进入 scaffold
写入；spy/fake operation 同时证明 create 未调用 fetch 或其他网络操作。
错误 branch/upstream、detached HEAD 及任一 worktree change 会阻止写入并
返回对应问题。

### I-AC02: 三类用户路径简洁且意图一致

双语单元和 contract 测试证明项目未整备、仓库未整备与创建结果只显示当前
路径需要的事实；create 报告不含 active candidate、idea counts、primary tip
或 fetch outcome。“交互语言”及 resolved tag 在文本中准确呈现，JSON 仍能
区分继承语言和显式 override。

### I-AC03: 成功和失败结果均可可靠行动

创建成功测试证明 observation 与 outcome 报告新 idea 根路径且不枚举冗余
文件，instructions 先引导完善三层契约和 ledger；故障注入测试证明部分写入
失败不返回 `createdIdea`，报告清理/保留路径，并且不覆盖或删除并发修改。

### I-AC04: 发布候选完整一致

实现、packaged skill 和公开文档描述相同 readiness 与输出契约；
`pnpm check`、`git diff --check`、`silvermoon check --worktree` 和
`silvermoon check --staged` 通过，结果记录于 ledger。
