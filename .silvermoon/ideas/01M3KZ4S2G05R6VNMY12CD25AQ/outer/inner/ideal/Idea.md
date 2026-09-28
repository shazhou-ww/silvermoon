# 收紧 create-idea 的整备边界与输出

## Intent

让 `silvermoon create-idea` 只观察创建新 idea 所必需的项目和本地仓库条件，
并在项目未整备、仓库不满足安全创建条件以及创建结果三个路径中，输出与当前
创建意图直接相关、简洁且可操作的信息。

## Context

`create-idea` 目前复用 `whats-next` 的完整 repository synchronization
preflight。它会展示 active idea 计数和“可继续推进的想法”，并在 worktree
干净后 fetch primary、检查 ahead/behind/diverged，甚至要求先 push 本地
commit。这些事实适合导航已有工作，却不是创建一个本地 idea scaffold 的必要
条件；额外远端访问和同步要求还会延迟或阻止彼此独立的新想法登记。

当前文本也存在意图和术语噪声：

- “使用项目的有效语言”不是面向用户的准确术语；配置和状态区已经使用
  “交互语言”，且解析结果未必来自项目级配置；
- 整备受阻时仍展示 active ideas，使显式创建意图看起来可以被已有 idea
  替代；
- `repository-sync-required` 与“仍需整备或同步”把本地安全条件和远端同步
  混在一起；
- 创建成功后列出 scaffold 的每一个文件，并立即给出检查、stage、commit、
  publish 的长链条，掩盖了紧邻动作其实是先写好新 idea 的道心并同步占位；
- 共用渲染容易让 JSON 中的无关 inventory、文本标题和 instructions 再次漂移。

此前对 `whats-next` 的打磨已经确立“按意图区分 observation、只呈现当前
视图需要的事实、文本由结构化报告直接渲染、失败不伪装成功”的原则。本 idea
将这些原则应用到 `create-idea`，但不削弱创建前保护未知本地工作的边界。

## Desired outcome

### 创建意图

未显式传入 `--language` 时，意图使用已解析出的“交互语言”术语，不再称为
“项目的有效语言”。默认文本应说明“创建一个新 idea，并使用
`<resolved-tag>` 撰写自然语言内容”或等价的简洁表述；JSON 继续保留调用者
是否显式提供 language override 的事实，不把解析后的继承值伪装成参数。
显式 override 仍使用规范化后的 tag。

### 项目未整备

项目配置、schema、canonical skill 或 idea layout 等创建所依赖的项目事实
不可用时，报告所有当前可确认的项目整备问题和有序修复建议。该路径不观察
repository readiness、不访问远端、不展示 idea inventory 或可推进候选，
也不尝试创建 scaffold。

### 仓库不满足安全创建条件

项目就绪后，`create-idea` 只要求：

1. 当前 worktree 位于配置的 primary branch，且其 upstream 指向配置的
   primary repository 和 branch；
2. 没有 conflict、staged、unstaged 或 untracked change。

不要求本地 HEAD 与 remote tip 相等，不判断 ahead、behind 或 diverged，
不 fetch，也不要求 pull、push、merge 或 rebase。这样既避免新 scaffold
混入其他正在进行的修改，也允许在尚未同步远端时先登记新想法。

任一条件不满足时，使用准确表达“本地仓库需整备”的 create 专属状态和文案，
列出全部已知阻塞问题；不显示 active ideas、全局 lifecycle 计数或远端同步
建议。worktree 摘要仍受固定预算限制，instructions 明确要求检查完整改动并
保护未知工作；修复后重跑保持原参数的 `create-idea`。

### 创建结果

安全条件通过后才写入 canonical scaffold。成功 observation 只报告新 idea
的 ID、可选 alias、初始状态和 idea 根路径；成功 outcome 用一行说明 scaffold
已创建，不枚举可从根路径推导出的五个文件。下一步只引导 Agent 使用当前
交互语言完善 `Idea.md`，并保持 `Implementation.md`、`Deployment.md` 与
`ledger.md` 的稳定 ID/占位同步；在内容形成前不提前展开发布流水线。

实际写入失败时使用独立失败状态，明确错误、可能残留或因内容变化而保留的
路径及恢复条件，不携带 `createdIdea`，也不输出成功形态的后续建议。

### 一致的报告边界

`create-idea` 继续输出单一
`{ intention, observation, outcomes, instructions }` envelope。各路径由
create 专属的 discriminated observation state 判别，默认文本直接渲染同一
报告，不解析 instructions 推断状态。无关的 `ideas.counts`、
`activeIdeas`、primary tip 和 fetch outcome 不进入 create 报告。
英文和中文使用相同信息层级、术语边界与失败语义。

## Scope

### In scope

- 拆分 `create-idea` 与 `whats-next` 的 repository readiness 策略，同时复用
  底层 Git/project 观察原语，避免复制诊断实现。
- 定义项目未整备、本地仓库未整备、创建成功和创建失败的 observation 字段、
  默认文本、outcomes 与 instructions。
- 将 create 的安全条件限制为 primary branch/upstream identity 与 clean
  worktree，移除 fetch 和 ancestry/synchronization gate。
- 移除 create 输出中的 active idea inventory、lifecycle counts 和无关候选。
- 统一“交互语言”术语，并让未 override 的意图文本显示本次解析出的 tag。
- 精简成功 scaffold outcome 和下一步建议，同时保留失败清理的完整事实。
- 同步 CLI/API、skill、reference/operations/getting-started 文档以及单元、
  contract、integration 和 installed-package e2e 测试。

### Out of scope

- 不改变裸或指定 selector 的 `whats-next` 同步、导航和候选选择行为。
- 不改变 `check` 的 snapshot 目标、退出码或 remote validation。
- 不允许 dirty worktree 下创建，不自动 stash、commit、checkout、pull、
  push、merge、rebase 或丢弃现有修改。
- 不改变 language 配置优先级、BCP 47 规范化、显式 override 的持久化规则，
  或 idea lifecycle 状态机。
- 不改变 scaffold 的 canonical 文件结构和写入失败时“只清理本次仍拥有的
  内容、保留已被修改路径”的原则。
- 不在本 idea 中设计交互式输入、自动命名或自动批准新 idea。

## Constraints

- primary branch 与 upstream identity 必须从同一次可信 observation 判断；
  detached HEAD、错误 branch、缺失 upstream 或错误 repository/branch 都必须
  阻止创建并给出可操作诊断。
- clean worktree 检查必须覆盖 conflicts、staged、unstaged 和 nonignored
  untracked paths；摘要可以截断，但计数和完整检查要求不能丢失。
- `create-idea` 在任何路径都不得 fetch 或依赖网络可用性；测试应以禁止调用
  remote operation 的断言证明，而不是只观察某个 fixture 恰好离线成功。
- 项目整备问题仍优先于仓库和 idea reasoning；在项目观察边界不可信时不得
  编造 branch、language 或创建结果。
- 成功状态描述的是创建前安全条件和实际 scaffold 结果，不能声称创建后
  worktree 仍然 clean。
- JSON 变化按当前未承诺兼容的对话契约直接升级，不新增旧形状兼容层；公开
  文档和 packaged skill 必须与实现同时更新。
- 错误必须显式呈现；不得用空列表、默认成功、吞掉异常或仅靠退出码表达失败。

## Open questions

- create 专属的本地仓库阻塞状态应命名为 `repository-preparation-required`
  还是更聚焦的 `create-preflight-required`？实现前由 interface review
  结合现有 state 命名约定确定。
