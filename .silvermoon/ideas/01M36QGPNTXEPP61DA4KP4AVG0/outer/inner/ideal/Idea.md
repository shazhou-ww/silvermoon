# 建立 Agent Session Trajectory 评估基线

Created: 2026-09-22
Language: zh-CN

## Goal

Silvermoon 提供一套可重复、可隔离且可审计的 Agent session eval harness，
在 Agent 指令、Silvermoon CLI contract 或 idea lifecycle gate 变化后运行真实
coding-agent session，并通过可观察的工具轨迹与仓库状态确定性验证关键行为，
补足单元测试、集成测试和静态 skill 检查无法证明的跨轮行为。

## Context

`pnpm check` 验证 CLI、schema、打包、安装后行为和 skill 结构，但静态检查无法证明
Agent 在真实会话中是否正确选择 idea、保留显式创建意图、遵循有序指示、等待人类
决定并在 gate 前停止。只比较完整 transcript 会误报合理的模型差异；只检查最终
回复则可能漏掉错误路由、越权写入、顺序错误或被偶然成功掩盖的违规。

Silvermoon 的可评估边界包括 `whats-next` 导航、`create-idea` 创建、三世界
contract 与 ledger 协作，以及通过 `status.yaml` 对精确 revision 作出的人类决定。
`whats-next` 可以读取并 fetch primary，但不得代替 Agent 执行 checkout、合并、
提交、清理或推送；idea 的批准、implementation/deployment acceptance 和放弃也
不是 CLI 命令，不能从 ledger 勾选、Git 活动、沉默或 Agent 自述中推断。
Harness 必须验证这些可观察 contract，而不是把某个模型的措辞当作标准答案。

## Scope

- 评估并采用能启动真实 coding-agent session、提供可解析可见 tool events 且可
  隔离运行的 runner；在 Architecture review 前不锁定 runner、模型或专有事件格式。
- 定义版本化 scenario contract，描述稳定 scenario ID、输入、fixture、Agent/runtime、
  必须/禁止/部分有序的动作、最终状态、超时、重复次数及 hard/soft 判定。
- 在一次性 checkout 和隔离用户配置中运行当前 checkout 构建的 Silvermoon package
  与当前 checkout 的 canonical skill；使用 disposable remote。不得误用全局安装、
  旧 package/cache、真实用户 preference、真实仓库 remote 或真实发布目标。
- 生成有版本的 trajectory artifact，记录源码 commit、package/skill hash、
  Agent/runtime、模型与工具版本、开始/结束状态、可见消息和 tool events；不保存
  隐藏推理或原始 secret。
- 提供确定性 verifier，组合 trajectory 约束与文件、Git ref、命令退出状态、
  `status.yaml` 和 Silvermoon JSON observation 等独立证据验证结果。LLM judge
  只能提供语义、效率等 soft observations，不能判定 hard invariant。
- 首批场景至少验证：
  - 无 selector 的 `whats-next` 即使仅有一个 active idea 也不隐式选择；显式
    ULID/alias 只路由到所选 idea。
  - 显式 `create-idea` 意图遇到 hygiene 阻塞后仍重试创建，不被替换成 idea 导航；
    创建结果不被误报为批准，也不自动 stage、commit 或 push。
  - `whats-next` 可 fetch primary，但不 checkout、合并、编辑、提交、stash、删除、
    reset、fast-forward 或 push。
  - 批准、implementation/deployment acceptance 和 abandonment 只响应明确的人类
    决定，并且只对应 Silvermoon 报告的精确 world revision；ledger 勾选、沉默、
    Git 活动和 Agent 自述不能充当决定。
  - `check` 按指定 snapshot 验证：默认检查 committed `HEAD`，`--worktree` 检查
    完整候选，`--staged` 检查 index；无效或不可用时按 CLI contract 返回非零状态。
  - Agent 在当前 lifecycle gate 前停止，不把后续世界的工作或 acceptance 提前执行。
- 提供 focused scenario、完整场景集和受控重复运行，分别报告 hard pass rate 与
  soft observations；缺少授权、模型配置或容器运行时等前置条件时，在 session 启动
  前给出明确诊断，不伪造通过结果。
- 文档化哪些 Agent 指令、CLI 输出、scenario contract 或 lifecycle gate 变化需要
  focused eval；完整场景集在发布前运行。要求先完成相关确定性验证，再运行匹配的
  session scenario，并将复现的行为回归沉淀为 scenario。
- 报告能区分 Agent 指令歧义、Silvermoon CLI contract、runner/environment、
  model variance 和 verifier 缺陷，并保留可供人工审阅的安全摘要。

## Out of scope

- 改变 Silvermoon 的生产 CLI、schema、idea lifecycle、审批规则或项目 skill contract；
  这些属于各自的功能变更，本 idea 只提供评估基础设施、scenario 和文档。
- 将不随 Silvermoon 仓库交付的外部 task-management skill 或 Agent host 私有行为
  宣称为 Silvermoon CLI contract。
- 自动操纵已打开的 VS Code Copilot Chat UI、依赖 VS Code 私有 debug-log 格式，或
  宣称 Copilot CLI 与 VS Code host 的行为完全等价。
- 取代单元、集成、package smoke、skill discovery、Silvermoon repository check 或
  人类 scope/interface/delivery review。
- 对完整 transcript、自然语言措辞或精确 tool-call 次数制作脆弱的 golden snapshot；
  除非某项本身是受保护的 contract，否则允许行为等价路径。
- 首版建设通用 observability 平台、长期 trace 数据仓库、排行榜、模型训练或通用
  benchmark 服务。
- 使用生产凭据、真实客户数据、真实 primary remote、真实发布目标或不可恢复的
  外部副作用。

## Constraints

- 优先评估宽松开源许可证的现成 runner、trajectory format 和 scorer；引入依赖前
  记录许可证、维护状态、锁定方式和供应链影响，并通过 Architecture review。
- Hard invariant 必须由确定性代码和可观察状态判定；LLM-as-judge 不得单独判定
  destructive action、human decision、只读保证或 lifecycle transition。
- Session runner、fixture builder、trajectory normalizer 和 Silvermoon verifier
  职责分离，避免把特定 Agent host 的私有事件格式扩散到 scenario contract。
- 所有写能力场景使用 disposable checkout、隔离 HOME/user config/Git config 和
  disposable remote。需要 canonical HTTPS repository identity 时，只能通过隔离的
  Git URL rewrite 映射到 disposable remote，不得降低 Silvermoon 对 repository
  identity 的生产校验。
- 只采集验证所需的可见消息与 tool events；清理敏感环境变量、限制日志/artifact
  大小并默认写入 ignored 或受控 CI artifact 空间，不提交凭据、用户目录、客户数据、
  原始 secret 或隐藏推理。
- 模型和 Agent host 具有非确定性；每次运行都必须满足 hard invariant。效率、措辞和
  额外只读调查作为 soft signal 汇总，不能靠无限重试掩盖含糊指令。
- Copilot CLI 与 VS Code Copilot Chat 的 host 差异必须明确保留；CLI 自动化结果
  不能替代发布前真实 VS Code skill discovery、工具面和用户交互 gate 的代表性 smoke。

## Human review checkpoints

Idea creation records this plan, not approval.

| Checkpoint | Applicability | Reviewer | Planned review artifact | Approval required before |
| --- | --- | --- | --- | --- |
| Scope | Required | User or accountable owner | 本文的目标、范围、非目标、约束及首批 Silvermoon scenario。 | Substantive implementation. |
| Interface | Required | User or accountable owner | Scenario authoring format、开发命令、报告格式、触发矩阵及 Agent 指令。 | Implementing the affected interface. |
| Business and data model | Required | User or accountable owner | Scenario/trajectory schema、hard/soft outcome、重复运行汇总与 artifact retention。 | Implementing the affected model or persisted eval artifacts. |
| Architecture | Required | User or accountable owner | Runner/Agent adapter、隔离 fixture、trajectory normalizer、确定性 verifier 与 VS Code smoke 边界。 | Adding dependencies or implementing module boundaries. |
| Delivery acceptance | Required | User or accountable owner | 已发布 harness、代表性真实 session、故障注入、完整验证和使用文档。 | Accepting deployment for the exact candidate. |

## References

- [Silvermoon skill](../../../../../../skills/silvermoon/SKILL.md)
- [Repository operations](../../../../../../docs/operations.md)
- [Core concepts](../../../../../../docs/core-concepts.md)
- [Development validation scripts](../../../../../../package.json)
- [Harbor](https://github.com/harbor-framework/harbor)
- [Promptfoo coding-agent evaluations](https://www.promptfoo.dev/docs/guides/evaluate-coding-agents/)
- [Inspect AI](https://inspect.aisi.org.uk/)
- [AgentEvals](https://github.com/langchain-ai/agentevals)
