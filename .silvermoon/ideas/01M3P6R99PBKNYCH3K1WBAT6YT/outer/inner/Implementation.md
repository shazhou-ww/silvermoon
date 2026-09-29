# 实施

## Steps

### I-S01: 用 Agent 导航替代固定整备指令

围绕单一项目 Agent 入口 `npx silvermoon whats-next` 重写两份 README 的 Quick
Start。提供一句可直接复制并从项目中发送给 coding agent 的提示词，要求 Agent
遵循当前报告、保留已有工作，并在产生可观察变更后重复运行，直至默认输出报告
`navigation-ready`。从这些章节移除固定的 dependency、package manager、skill
注册与 snapshot 检查配方。

### I-S02: 在默认输出中展示导航就绪状态

在成功的裸 `whats-next` 导航本地化 response summary 中包含精确的
`navigation-ready` 状态。保持四个 projection 的 JSON 形状与 observation state
不变；人类可读 renderer 仍只渲染自足的 response。

### I-S03: 以回归覆盖和 issue 可追踪性保护工作流

为可见的就绪状态和 Agent 引导的 Quick Start 边界增加英文与中文回归断言。保持
CLI 输出问题与 [GitHub issue #1](https://github.com/shazhou-ww/silvermoon/issues/1)
关联。

## Acceptance criteria

### I-AC01: Quick Start 将整备委托给项目 Agent

`README.md` 与 `README.zh-CN.md` 使用 `text` 代码块提供可直接复制给 coding
agent 的单句提示词，其中包含 `npx silvermoon whats-next`，并要求显示精确可见的
`navigation-ready` 状态，同时省略固定安装和注册配方。documentation contract
test 证明两个章节均包含复制指引、提示词和必要边界，且排除了相关细节。

### I-AC02: 人类可读就绪状态与 observation 一致

对于英文与中文裸导航，默认输出包含精确的 `navigation-ready` 值，同时
`observation.state` 保持为 `navigation-ready`。unit 与 integration tests
证明本地化渲染文本及未改变的结构化 observation。

### I-AC03: 输出缺口保持共同可追踪

本实现契约继续关联 GitHub issue #1，且该 issue 描述人类可读就绪状态缺失问题。
可通过 GitHub issue API 或 CLI 验证其 URL 与 open 状态。

### I-AC04: 仓库验证通过

实现候选通过完整的 `pnpm check` suite，包括 unit、integration、contract、
end-to-end、skill、Markdown 与 package 检查。
