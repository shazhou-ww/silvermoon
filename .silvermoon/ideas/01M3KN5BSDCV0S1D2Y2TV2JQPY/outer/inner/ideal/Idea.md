# 区分 whats-next 的导航与目标观察视图

## Intent

让 `whats-next` 的 observation 如实区分“列出可选工作”和“查看指定 idea”，
使 JSON 和默认文本都只呈现当前意图所需的事实，而不依赖从 instructions
反推所选 idea 的状态。

## Context

目前裸调用与显式 selector 共享一份面向全局 inventory 的 observation：
`ideas.counts` 和 `activeIdeas` 总是出现在就绪的报告中。显式选择 idea 时，
默认文本重复全局统计和活跃列表，却没有单独显示该 idea 的状态；
`completed` 和 `abandoned` 也不在 `activeIdeas` 中，无法从现有观察字段
可靠渲染其状态。另一处噪声是：本地 HEAD 与 fetch 后 primary 已对齐时，
默认文本仍会展示例行成功的 `fetch-primary` 结果。

现有 whats-next 对话契约由
[`Idea.md`](../../../../01M3AT95KSJH5JWCYXXK8RZF5W/outer/inner/ideal/Idea.md)
定义；本 idea 讨论在其基础上的输出契约修订，而非重做三层整备逻辑。

## Desired outcome

- 项目和仓库整备未通过时，两种调用共用可信的整备观察和全部 problems，
  不提前宣称已完成 idea 导航。
- 就绪后，裸调用提供全局导航视图，包括各状态计数和全部 active ideas；
  一个候选也不自动替用户选择。
- 就绪后，显式 selector 匹配时提供目标视图，明确包含该 idea 的标识、
  可选 alias 和五种 lifecycle 状态之一；默认文本简洁说明项目就绪和目标状态，
  不重复全局活跃列表。终态 idea 也能如实表示。
- selector 未匹配时给出独立的未找到结果和恢复建议，不伪装成已选择。
- 所有视图仍通过同一 `intention / observation / outcomes / instructions`
  envelope 输出。JSON 保留实际 fetch outcome；默认文本可以省略本地 HEAD
  与观测 primary 对齐时的例行成功 fetch，但失败或需要同步时不得隐藏
  关键信息。文本不通过解析 instructions 推断结果。

## Scope

### In scope

- `whats-next` 就绪阶段按裸调用、匹配 selector、未匹配 selector 判别
  observation 的字段保证及默认文本呈现。
- 保留并澄清项目与仓库整备阶段共享的观察边界和问题优先级。
- 例行成功 fetch 的文本省略条件与 JSON 忠实记录的边界。
- 双语文案、schema、CLI、skill、参考文档和契约/集成/e2e 测试的同步。

### Out of scope

- 不改变 `create-idea` 的显式创建意图、`check` 的项目验证与退出码。
- 不改变 fetch 是否执行、primary 同步策略、实际 Git 副作用或
  completed/abandoned ideas 不进入裸调用默认候选的规则。

## Constraints

- 项目整备失败或仓库未同步时不能生成未经可靠验证的目标状态。
- JSON 不得因为文本压缩而隐瞒实际发生的 fetch；失败 outcome 必须显式呈现。
- 不从自然语言 instructions 反向解析状态，也不维护第二套文本推演逻辑。
- 需要决定现有 JSON 消费者如何识别新版就绪 observation，以及是否涉及
  公共 schema version 的升级；不得悄悄把旧字段改为不兼容形状。

## Open questions

- 就绪观察的判别字段应如何命名、如何与现有
  `task-pending` / `idle` 状态并存？目标视图是否保留 counts，还是只保留
  `selectedIdea` 及其生命周期事实？
- 未匹配 selector 的观察是否附带候选列表，以及如何避免把它误判为已选择？
- 例行 fetch 的“可省略”条件应精确定义为本地 HEAD 与本次 fetch 取得的
  primary commit 对齐，还是还需要比较调用前已知的远端 tip？
- 对已有 `whats-next --json` 消费者采用何种明确的兼容或迁移方案？
