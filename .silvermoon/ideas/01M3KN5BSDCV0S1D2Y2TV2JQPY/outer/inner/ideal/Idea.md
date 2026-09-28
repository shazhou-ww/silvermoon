# 区分 whats-next 的导航与目标观察视图

## Intent

按三个命令表达四种意图：`check`、`create-idea`、裸 `whats-next`、
指定 idea 的 `whats-next`。每种意图定义自己的 observation，使 JSON
和默认文本都只呈现当前意图所需的事实，而不依赖从 instructions
反推任务状态。

## Context

目前裸调用与显式 selector 共享一份面向全局 inventory 的 observation：
`ideas.counts` 和 `activeIdeas` 总是出现在就绪的报告中。显式选择 idea 时，
默认文本重复全局统计和活跃列表，却没有单独显示该 idea 的状态；
`completed` 和 `abandoned` 也不在 `activeIdeas` 中，无法从现有观察字段
可靠渲染其状态。`create-idea` 成功后也继续呈现创建前的活跃列表，
而不是刚创建的 idea。另一处噪声是：本地 HEAD 与 fetch 后 primary 已对齐时，
默认文本仍会展示例行成功的 `fetch-primary` 结果。

现有对话与检查契约由
[`Idea.md`](../../../../01M3AT95KSJH5JWCYXXK8RZF5W/outer/inner/ideal/Idea.md)
定义；本 idea 讨论在其基础上的输出契约修订，而非重做三层整备逻辑。

## Report model

- 四种意图各有自己的 observation 类型；每种类型可以再按整备阶段、
  就绪结果或失败结果细分为 discriminated union。项目整备、仓库整备等底层
  观察可复用，但不强迫不同命令暴露相同的 JSON 形状。
- `whats-next` 与 `create-idea` 仍输出
  `{ intention, observation, outcomes, instructions }`。`outcomes`
  共用已尝试副作用的有序记录结构，`instructions` 共用自然语言建议的
  字符串结构；具体内容由各自的意图和观察决定。
- `check` 仍只输出 `{ intention, observation }`；没有对话式
  `outcomes` 或 `instructions`，其检查目标、结论和退出码语义不变。
- 裸 `whats-next` 的就绪 observation 为 `navigation-ready`，
  指定 idea 的就绪 observation 则分 `idea-selected` /
  `idea-not-found`，直接由各自 `state` 判别，不额外叠加 `view`。
  `create-idea` 也使用自己的就绪结果类型。

| 意图 | 可出现的 observation state | 就绪后的专属事实 |
| --- | --- | --- |
| `check` | `project-setup-required`、`check-unavailable`、`project-ready` | 经验证的目标快照与结论；不输出对话建议 |
| `create-idea` | `project-setup-required`、`repository-sync-required`、`idea-created`、`idea-create-failed` | 成功时是新 idea；尝试创建失败时是可靠的失败结果 |
| 裸 `whats-next` | `project-setup-required`、`repository-sync-required`、`navigation-ready` | 全局状态计数、全部活跃候选（可为空） |
| 指定 idea 的 `whats-next` | `project-setup-required`、`repository-sync-required`、`idea-selected`、`idea-not-found` | 命中时为所选 idea；未命中时为活跃候选 |

`project-setup-required` 沿用已有 `observedThrough` 累进保证；
`repository-sync-required` 仍报告全部已知问题和整备建议，不生成尚未可信的
导航或创建结果。就绪分支复用可靠的 root、version、resolved configuration
和空 problems，但只携带该意图自己的任务事实：

- `navigation-ready.ideas` 含五种状态的 counts 与全部 active ideas；
  取代裸调用的 `task-pending` / `idle`，空候选由 `activeIdeas: []` 明示。
- `idea-selected.selectedIdea` 含 ID、可选 alias、五种状态之一；不携带全局
  `ideas`。指定终态 idea 也能够如实说明状态和下一步 review。
- `idea-not-found` 只含活跃候选，不含 `selectedIdea`；请求的 selector 已在
  `intention.args.idea` 中，不以猜测或空对象表示匹配成功。instructions 同时
  给出重新选择或讨论新 idea 的选项。
- `idea-created.createdIdea` 至少含已成功创建的 ID 与初始状态 `preparing`；
  不把创建前 inventory 当成创建后观察。该结果中的仓库就绪只表示**创建前**
  已通过检查，不能断言创建后 worktree 仍干净；文件创建属于 outcomes。
- `idea-create-failed` 仅用于项目及仓库整备通过、实际尝试 scaffold 后失败，
  不携带 `createdIdea`。失败 outcome 说明错误、可能保留的路径与清理结果，
  instructions 说明保护现存工作和恢复条件。整备阶段阻止创建时不使用该状态。

## Desired outcome

- 项目和仓库整备未通过时，两种调用共用可信的整备观察和全部 problems，
  不提前宣称已完成 idea 导航。
- 就绪后，裸 `whats-next` 使用 `navigation-ready` observation，
  包含各状态计数和全部 active ideas；列表可以为空，一个候选也不自动替用户选择。
- 就绪后，显式 selector 匹配时使用 `idea-selected` observation，
  包含所选 idea 的 ID、可选 alias 和五种 lifecycle 状态之一，不包含全局
  `ideas.counts` / `activeIdeas`。默认文本简洁说明项目与仓库就绪、目标标识
  及其状态；终态 idea 也能如实表示。
- selector 未匹配时使用 `idea-not-found` observation，明确未找到目标，并
  附上活跃候选供重新选择，instructions 仍说明可讨论并创建新 idea。
- `create-idea` 在就绪且创建成功后使用独立 observation，呈现新 idea 而非
  创建前 inventory；该结果应明确仓库就绪判断发生在创建之前，不能把
  新文件造成的 dirty worktree 误报为创建后仍干净。失败时不能伪装成创建成功。
- 各就绪视图直接由独立 observation 类型及其 `state` 判别，不在共用
  `task-pending` / `idle` 上叠加另一个 `view` 字段。
- 所有视图仍通过同一 `intention / observation / outcomes / instructions`
  envelope 输出。JSON 保留实际 fetch outcome；默认文本在本地 HEAD
  与本次 fetch 所得 primary commit 对齐时省略例行成功 fetch，
  失败或需要同步时仍呈现。即便 JSON 的 `outcomes` 非空，过滤后没有
  可呈现的操作时也省略整段。文本不通过解析 instructions 推断结果。

## Scope

### In scope

- 对话命令的就绪阶段按裸调用、匹配 selector、未匹配 selector、创建成功及
  创建失败判别 observation 的字段保证与默认文本呈现。
- 保留并澄清项目与仓库整备阶段共享的观察边界和问题优先级。
- 例行成功 fetch 的文本省略条件与 JSON 忠实记录的边界。
- 双语文案、CLI、skill、参考文档和契约/集成/e2e 测试的同步。

### Out of scope

- 不改变 `create-idea` 的显式创建意图、`check` 的项目验证与退出码。
- 不改变 fetch 是否执行、primary 同步策略、实际 Git 副作用或
  completed/abandoned ideas 不进入裸调用默认候选的规则。

## Constraints

- 项目整备失败或仓库未同步时不能生成未经可靠验证的目标状态。
- JSON 不得因为文本压缩而隐瞒实际发生的 fetch；失败 outcome 必须显式呈现。
- 不从自然语言 instructions 反向解析状态，也不维护第二套文本推演逻辑。
- 当前没有外部 JSON 消费者；直接升级现有输出即可，不新增版本选项，也不保留
  旧形状的迁移兼容层。公开的 `schema/v1` 是配置和状态文件 schema，不是对话
  JSON schema；参考文档只需准确说明新契约，无须记录迁移历史。
