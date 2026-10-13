# Objective Guidance 类型体系

## 术语表

### 架构术语

| 术语 | 中文 | 定义 |
| --- | --- | --- |
| Objective Guidance | 目标导向体系 | 本文定义的总体架构名称，不对应额外运行时对象 |
| Objective | 目标维度 | 可独立观测且具有有限有序层级的一个评价维度 |
| Objective level | 目标层级 | Objective 内从 0 开始的连续序数，不表示等距收益，也不能跨 Objective 直接比较 |
| Target level | 目标水位 | OR 本轮需要达到的层级；可以低于理论最高层级 |
| Intermediate steady state | 中间稳态 | 系统主动接受某层代价并长期停留在非最高层的状态 |
| ObjectiveGuide（OG） | 目标向导 | 封装单一 Objective 的观测、问题指导与层级损益知识 |
| ObjectiveRegulator（OR） | 目标调节器 | 持有一个 OG，执行单目标探测、Agent 单步行动与复测闭环 |
| Probe-only operation | 仅探测运行 | OR 只调用 OG 探测，不调用 Agent；探测本身仍可产生 IO、成本与扰动 |
| Active regulation | 激活调节 | OR 根据 `targetLevel` 启动受保护的单目标行动循环 |
| Objective Portfolio | 目标组合 | 由 OPS 同时观测和权衡的一组 Objective，不是独立 Domain 实体 |
| Portfolio policy | 组合策略 | 表达跨 Objective 的预算、优先级、互斥关系、窗口与延后选择 |
| Objective Portfolio Supervisor（OPS） | 目标组合监督器 | 监督多个 OR，采集组合观测、守住防御阈值并进行资源取舍 |

### OG 与装载术语

| 类型或术语 | 中文 | 定义 |
| --- | --- | --- |
| `ObjectiveId` | 目标标识 | Objective 在所属组合与传输单元中的稳定非空标识 |
| `ProblemId` | 问题标识 | OG 问题目录中的稳定非空标识 |
| `CheckId` | 检查标识 | Manifest 引用装载代码中目标检查的稳定名称 |
| `ObjectiveLevel` | 目标层级值 | 从 0 开始的连续非负整数序数 |
| `ObjectiveContext` | 目标上下文 | 传给观测、指导、损益和调节过程的只读运行时上下文 |
| `ObservedProblem` | 已观测问题 | 一次观测中出现的问题 ID 与本次事实描述 |
| `ObjectiveObservation` | 目标观测 | OG 对当前 level、按处置顺序排列的问题和总体 gap 的近似样本 |
| Reference Wiki | 引用 Wiki | OG 知识的序列化和编辑形式，由平级页面及其内部链接构成 |
| `WikiPageId` | Wiki 页面标识 | 与文件路径无关的稳定非空页面 ID |
| `ReferenceWikiPageSummary` | Wiki 页面摘要 | Agent 搜索 Wiki 时取得的页面 ID、标题与开放标签 |
| `ReferenceWikiPage` | 引用 Wiki 页面 | 已装载页面的入口声明、正文及其内部 Wiki link |
| `ObjectiveReferenceWiki` | 目标引用 Wiki | 绑定当前上下文并交给 Agent 主动打开问题、读取页面和搜索的查询接口 |
| `ObjectiveOutcomeAssessment` | 目标损益评估 | 当前层代价、下一层及其潜在收益的语义化说明 |
| `ObjectiveLevelDescription` | 层级说明 | OG 对一个层级的稳定名称和含义描述 |
| OG transport unit | OG 传输单元 | 装载前承载 Manifest、代码与 Reference Wiki 的 folder、package 或等价载体 |
| `ObjectiveGuideManifest` | 目标向导清单 | 传输单元内可序列化的身份、层级、检查、Wiki 位置和静态损益索引 |
| `ObjectiveLevelManifest` | 层级清单项 | 一个层级的说明、从该层进入下一层的检查和静态损益 |
| `StaticOutcomeDescription` | 静态损益说明 | Manifest 中当前代价与下一层收益的默认文本 |
| `CheckResult` | 检查结果 | 目标检查的通过结果，或带非空问题的未通过结果 |
| `ObjectiveCheck` | 目标检查 | 可执行且允许 IO 的单个层级进入判据 |
| `OutcomeAssessor` | 损益评估器 | 可依据本次观测和上下文动态生成损益评估的装载绑定 |
| `ObjectiveGuideLoadBindings` | OG 装载绑定 | Loader 将 Manifest 中稳定 ID 连接到检查和动态实现的代码表 |
| `createObjectiveGuide` | OG 创建工厂 | 传输/装载边界使用的默认工厂；成功后只返回运行时 `ObjectiveGuide` |

### OR 与 OPS 术语

| 类型或术语 | 中文 | 定义 |
| --- | --- | --- |
| `RegulationLimits` | 调节限制 | 最大动作次数、总超时和连续无进展上限 |
| `ObjectiveActionRequest` | 目标行动请求 | OR 交给 Agent 的单步问题、Reference Wiki、目标水位、观测与上下文 |
| `ObjectiveActionResult` | 目标行动结果 | Agent 对一次行动报告完成或阻塞；不直接证明 level 已改变 |
| `ObjectiveActionExecutor` | 目标行动执行器 | OR 用于请求 Agent 只执行一次现实动作的边界 |
| `RegulationRequest` | 调节请求 | 一轮 OR 调节的目标水位、上下文和保护限制 |
| `RegulationStatus` | 调节状态 | 目标达成或某种受控停止原因的判定值 |
| `RegulationResult` | 调节结果 | 状态、动作次数、目标水位与最新重新观测 |
| `ObjectiveSafetyThresholds` | 目标安全阈值 | 触发防御的最低水位与防御任务应恢复到的目标水位 |
| `ObjectiveRegistration` | 目标注册 | OPS 对 Objective ID、对应 OR 和安全阈值的关联 |
| `ObjectivePortfolioEntry` | 目标组合条目 | 一个 Objective 的观测、损益评估和安全阈值 |
| `ObjectivePortfolioObservation` | 目标组合观测 | 多个非原子目标样本组成的组合视图，不声称为瞬时快照 |
| `RegulationTrigger` | 调节触发来源 | 区分防御性任务与窗口驱动的进取性任务 |
| `RegulationDirective` | 调节指令 | OPS 下发给某 OR 的目标水位、触发来源、理由和限制 |
| `DeferredObjective` | 延后目标 | 本轮未激活调节的 Objective 及其明确原因 |
| `ObjectivePortfolioPlan` | 目标组合计划 | 按优先级排列的调节指令与延后项 |
| `ObjectivePortfolioPolicy` | 目标组合策略函数 | 根据组合观测和上下文形成组合计划的跨目标策略 |
| `ObjectivePortfolioRunResult` | 目标组合运行结果 | OPS 执行计划后按 Objective 收集的 OR 结果 |

`Objective` 是一个可独立观测、具有有限有序层级的评价维度。`Portfolio`
只表达由 OPS 管理的一组 Objective，不引入额外 Domain 概念或要求独立
Portfolio 实体。公开类型不使用势场、势能等物理隐喻。

层级是单个 Objective 内的序数，不表示等距收益，也不能跨 Objective 直接
相加比较。最高层级唯一，但满足该层的现实状态可以有多个。系统允许长期停留
在中间层级并承担相应代价；本轮是否提升以及提升到哪一层由 OPS 决定。

## 命名评注

以下结论用于稳定当前候选，不增加新的公共概念：

| 名称 | 当前结论 | 说明 |
| --- | --- | --- |
| `ObjectiveObservation` | 采用 | 明确表达目标维度的非原子观测，避免泛化的结果或瞬时快照语义 |
| `CheckId` / `ObjectiveCheck` | 采用 | 检查允许 IO 并返回问题；`Assertion` 容易被误解为测试断言或抛错 |
| `RegulationStatus` | 采用 | 同时包含 `target-reached` 和停止原因，比 `Termination` 更中性 |
| `RegulationTrigger` | 采用 | `defensive` / `opportunistic` 表达任务来源，比泛化的 `Reason` 更准确 |
| `ObjectiveRegulator` | 保留 | `Restorer` 不能表达首次提升，`Controller` 又暗示直接控制现实；Regulator 同时覆盖恢复、维持和提升 |
| `ObjectivePortfolioSupervisor` | 保留 | 名称较长但准确表达多目标组合监督；代码使用全名，`OPS` 只用于文档简称 |
| `ObjectiveGuideManifest` | 保留 | 所在章节已明确其传输属性；只有出现多种 Manifest 冲突时才考虑 `ObjectiveGuideTransportManifest` |
| `ObjectiveContext` | 暂时保留 | 若实现证明观察对象身份与运行窗口具有不同生命周期，再拆成 `ObjectiveSubject` 和 `OperationContext`，不在缺少证据时预分层 |

## 公共基础类型

```ts
type ObjectiveId = string;
type ProblemId = string;
type CheckId = string;
type ObjectiveLevel = number;
type ObjectiveContext = Readonly<Record<string, unknown>>;
type WikiPageId = string;

interface ObservedProblem {
  id: ProblemId;
  description: string;
}

interface ObjectiveObservation {
  level: ObjectiveLevel;
  problems: readonly ObservedProblem[];
  gapSummary: string;
}

interface ReferenceWikiPageSummary {
  id: WikiPageId;
  title: string;
  tags: readonly string[];
}

interface ReferenceWikiPage extends ReferenceWikiPageSummary {
  problemIds: readonly ProblemId[];
  unknownProblemFallback: boolean;
  content: string;
  links: readonly WikiPageId[];
}

interface ObjectiveReferenceWiki {
  openProblem(problemId: ProblemId): Promise<ReferenceWikiPage>;
  readPage(pageId: WikiPageId): Promise<ReferenceWikiPage>;
  search(query: string): Promise<readonly ReferenceWikiPageSummary[]>;
}

interface ObjectiveOutcomeAssessment {
  level: ObjectiveLevel;
  currentCost: string;
  nextLevel: ObjectiveLevel | null;
  nextLevelBenefit: string | null;
}

interface ObjectiveLevelDescription {
  level: ObjectiveLevel;
  title: string;
  description: string;
}
```

ID 必须非空且在所属 OG 内稳定。层级是从 0 开始的连续非负整数。
`ObjectiveObservation.problems` 按 OG 建议的处理顺序排列；第一个问题是 OR
默认选择的下一处置对象。达到最高层级时问题列表可以为空，
`gapSummary` 仍需给出简短结论。证据不足时 OG 返回它能支持的层级，并用
问题明确表达知识缺口，不能把近似样本伪装成现实真值。

`ObjectiveReferenceWiki.openProblem` 返回声明当前 `problemId` 的入口页面；
未知问题返回唯一的 `unknownProblemFallback` 页面。Agent 可以按需调用
`readPage` 沿内部链接阅读，或用 `search` 主动查找页面。Wiki 调用次数、分页
和 Agent token 预算属于通用执行环境限制，不进入 OG Manifest 的领域语义。

`nextLevel` 和 `nextLevelBenefit` 在最高层级为 `null`。损益字段保持语义化，
不把序数层级伪装成可跨目标求和的效用分数。

## ObjectiveGuide

```ts
interface ObjectiveGuide {
  readonly id: ObjectiveId;

  describeLevels(): readonly ObjectiveLevelDescription[];

  probe(ctx: ObjectiveContext): Promise<ObjectiveObservation>;

  openReferenceWiki(
    ctx: ObjectiveContext,
  ): Promise<ObjectiveReferenceWiki>;

  assessOutcome(
    observation: ObjectiveObservation,
    ctx: ObjectiveContext,
  ): Promise<ObjectiveOutcomeAssessment>;
}
```

`probe` 是定向现实探测，允许 IO 和观测扰动，也可能经历时序撕裂。它不执行
现实修改，不保证事务性原子快照。`openReferenceWiki` 只把当前上下文绑定到
Wiki 查询接口，不替 Agent 选择、预取或裁剪知识。Agent 收到问题后主动打开
入口页面并按需阅读；未知 `problemId` 必须落到明确的知识缺口页面，不能伪装
成已知解法。

OG 只说明怎么看、问题怎么处理以及不同层级的损益。它不调用 Agent、不循环
修复，也不替代权限、人工接受或外部决定。

## OG 传输与装载规范

OG 可以通过 folder、package、数据库记录或其他可加载单元传输。它们只是
装载前的传输格式，不是运行时 OG。典型本地传输把原先分离的 guidance 和
docs 统一为一个 Reference Wiki；页面平级存放，目录层级不表达节点种类：

```text
my-objective-guide/
├── objective-guide.yaml
├── index.ts
├── checks/
└── references/
    ├── repository-not-ready.md
    ├── setup-runtime.md
    ├── primary-repository.md
    └── external-wait.md
```

Manifest 是传输单元内可序列化的静态描述符和资源索引，不等于运行时 OG。
代码、Reference Wiki 和 Manifest 一起构成传输单元；npm 只是可选分发载体，
不是模型概念。Wiki 页面通过 frontmatter 声明稳定 ID、零到多个 ProblemId、
开放 tags 和未知问题兜底角色，通过内部 Wiki link 相互引用。Loader 负责枚举
页面、解析链接并绑定代码，成功后只返回 `ObjectiveGuide`。业务代码、OR 与
OPS 不接收 Manifest、路径、完整 Wiki 或资源布局。

```markdown
---
id: repository-not-ready
problemIds:
  - repository-not-ready
tags:
  - repository
  - diagnosis
---

# Repository is not ready

先确认当前 checkout 是否对应 configured primary。

继续阅读 [[setup-runtime]] 与 [[primary-repository]]。
```

页面角色不使用封闭 kind 枚举。同一页面可以同时解释概念、提供操作方法和引用
证据；只有 `problemIds` 与 `unknownProblemFallback` 在 OG 协议中具有固定
入口语义。内部 Wiki link 使用稳定页面 ID，文件名和目录不是节点身份。

```ts
interface StaticOutcomeDescription {
  currentCost: string;
  nextLevelBenefit: string | null;
}

interface ObjectiveLevelManifest {
  title: string;
  description: string;
  checks: readonly CheckId[];
  outcome: StaticOutcomeDescription;
}

interface ObjectiveGuideManifest {
  schemaVersion: 1;
  id: ObjectiveId;
  title: string;
  levels: readonly ObjectiveLevelManifest[];
  referenceWiki: string;
}

type CheckResult =
  | { pass: true }
  | { pass: false; problems: readonly [ObservedProblem, ...ObservedProblem[]] };

type ObjectiveCheck = (
  ctx: ObjectiveContext,
) => Promise<CheckResult>;

type OutcomeAssessor = (
  observation: ObjectiveObservation,
  ctx: ObjectiveContext,
) => Promise<ObjectiveOutcomeAssessment>;

interface ObjectiveGuideLoadBindings {
  checks: Readonly<Record<CheckId, ObjectiveCheck>>;
  assessOutcome?: OutcomeAssessor;
}

// Transport-layer factory; runtime consumers use only the returned guide.
declare function createObjectiveGuide(
  manifest: ObjectiveGuideManifest,
  bindings: ObjectiveGuideLoadBindings,
): ObjectiveGuide;
```

对应的 YAML Manifest 可以保持很小，只声明按数组顺序排列的目标层级和唯一
支持的 Reference Wiki 位置；问题入口和页面链接仍由 Wiki 页面自身声明：

```yaml
schemaVersion: 1
id: repository-readiness
title: 仓库整备度
levels:
  - title: 尚不可用
    description: 尚无足够证据确认仓库可以开展工作
    checks:
      - project-valid
      - repository-ready
    outcome:
      currentCost: 无法安全推进依赖仓库事实的工作
      nextLevelBenefit: 可以在已确认的仓库基础上开展工作
  - title: 可以开展工作
    description: 项目与仓库事实已经满足本目标的基础判据
    checks: []
    outcome:
      currentCost: 仍需承担后续目标尚未完成的代价
      nextLevelBenefit: null
referenceWiki: references
```

`referenceWiki` 相对 Manifest 解析。默认工厂只支持这一种 Markdown
Reference Wiki，不通过 `format` 提供多种协议选择；其他载体应由手写 OG
自行适配，而不是扩大默认 Manifest。该位置只定位 Wiki，不规定页面文件名、
子目录或领域分类。

`levels` 的数组下标就是 level，不重复保存数字。`levels[i].checks` 是当前
第 i 层为了进入第 i+1 层需要执行的有序检查，因此 0 层可以且通常会有检查；
最高层没有下一层，其 `checks` 必须为空且 `nextLevelBenefit` 必须为 `null`。
空的非最高层检查组自然升级。默认工厂从 0 层开始逐级、逐关检查，首个未通过
处形成观测。Manifest 只保存稳定 check ID，folder 或 package 中的 load
bindings 提供对应代码，因此同一契约可由 YAML、JSON 或 TypeScript 数据
表达，而不要求序列化函数。

Loader 必须拒绝重复页面 ID、同一 ProblemId 的重复入口、多个未知问题兜底、
悬空内部链接与空页面；它不按目录或 tags 推断语义。Reference Wiki 允许环，
也允许一个页面处理多个问题或由多个问题入口共同引用。默认工厂装载这一种
Wiki 并通过 `openReferenceWiki` 暴露主动查询接口；它不按深度或页面数量替
Agent 预取知识。Load bindings 仍可提供动态 assessor，例如依据发布窗口改变
损益描述。
`createObjectiveGuide` 属于装载边界，其参数不会泄漏到运行时协作接口。高级
传输单元仍保留 Manifest 用于身份与发现，但可以使用自定义 loader 直接产出
手写 `ObjectiveGuide`，绕过默认探测和 Reference Wiki 装载。

## ObjectiveRegulator

```ts
interface RegulationLimits {
  maxIterations: number;
  timeoutMs: number;
  maxStalledIterations: number;
}

interface ObjectiveActionRequest {
  objectiveId: ObjectiveId;
  targetLevel: ObjectiveLevel;
  observation: ObjectiveObservation;
  problem: ObservedProblem;
  referenceWiki: ObjectiveReferenceWiki;
  context: ObjectiveContext;
}

type ObjectiveActionResult =
  | { status: "completed"; summary: string }
  | { status: "blocked"; reason: string };

type ObjectiveActionExecutor = (
  request: ObjectiveActionRequest,
) => Promise<ObjectiveActionResult>;

interface RegulationRequest {
  targetLevel: ObjectiveLevel;
  context: ObjectiveContext;
  limits: RegulationLimits;
}

type RegulationStatus =
  | "target-reached"
  | "no-actionable-problem"
  | "action-blocked"
  | "no-progress"
  | "max-iterations"
  | "timed-out";

interface RegulationResult {
  status: RegulationStatus;
  targetLevel: ObjectiveLevel;
  iterations: number;
  latestObservation: ObjectiveObservation;
}

interface ObjectiveRegulator {
  readonly guide: ObjectiveGuide;

  probe(ctx: ObjectiveContext): Promise<ObjectiveObservation>;

  regulate(
    request: RegulationRequest,
    executeAction: ObjectiveActionExecutor,
  ): Promise<RegulationResult>;
}
```

`probe` 是仅探测入口：它不会调用 Agent，但仍可能产生 OG 探测固有的 IO、
成本和扰动。`regulate` 的生产语义由框架持有循环：探测；判断是否达到
`targetLevel`；选择首个问题并把 Reference Wiki 作为查询工具交给 Agent；
Agent 主动查阅知识后只执行一次现实动作；然后框架重新探测。Wiki 查询属于
这次行动的认知过程，不是额外的 OR 迭代。Agent 不在 prompt 内自行维持复归
循环。

OR 不强制追求最高层，只到达本轮目标水位。迭代数是已请求的 Agent 动作次数；
Agent 报告 `completed` 不构成进展证据，新的 `probe` 才能确认状态。受控停止
使用 `RegulationStatus`；配置错误、探测缺陷或未建模的执行异常明确
reject，不被包装成成功形状的终止结果。

## Objective Portfolio Supervisor

```ts
interface ObjectiveSafetyThresholds {
  defensiveThreshold: ObjectiveLevel;
  defensiveTarget: ObjectiveLevel;
}

interface ObjectiveRegistration {
  objectiveId: ObjectiveId;
  regulator: ObjectiveRegulator;
  safety: ObjectiveSafetyThresholds;
}

interface ObjectivePortfolioEntry {
  objectiveId: ObjectiveId;
  observation: ObjectiveObservation;
  outcome: ObjectiveOutcomeAssessment;
  safety: ObjectiveSafetyThresholds;
}

interface ObjectivePortfolioObservation {
  entries: readonly ObjectivePortfolioEntry[];
}

type RegulationTrigger = "defensive" | "opportunistic";

interface RegulationDirective {
  objectiveId: ObjectiveId;
  targetLevel: ObjectiveLevel;
  trigger: RegulationTrigger;
  rationale: string;
  limits: RegulationLimits;
}

interface DeferredObjective {
  objectiveId: ObjectiveId;
  reason: string;
}

interface ObjectivePortfolioPlan {
  directives: readonly RegulationDirective[];
  deferred: readonly DeferredObjective[];
}

type ObjectivePortfolioPolicy = (
  observation: ObjectivePortfolioObservation,
  ctx: ObjectiveContext,
) => Promise<ObjectivePortfolioPlan>;

interface ObjectivePortfolioRunResult {
  results: readonly {
    objectiveId: ObjectiveId;
    result: RegulationResult;
  }[];
}

interface ObjectivePortfolioSupervisor {
  observe(ctx: ObjectiveContext): Promise<ObjectivePortfolioObservation>;

  plan(
    observation: ObjectivePortfolioObservation,
    ctx: ObjectiveContext,
  ): Promise<ObjectivePortfolioPlan>;

  execute(
    plan: ObjectivePortfolioPlan,
    ctx: ObjectiveContext,
    executeAction: ObjectiveActionExecutor,
  ): Promise<ObjectivePortfolioRunResult>;
}
```

OPS 的 `observe` 让各 OR 仅探测，并调用其 OG 的 `assessOutcome`。所得向量是
多个现实样本的组合，不宣称为同一时刻的原子快照。`plan` 先处理跌破
`defensiveThreshold` 的防御任务，再由 portfolio policy 在剩余预算和窗口中
决定进取任务、顺序与延后项。`directives` 的数组顺序表达调度优先级，不比较
不同 Objective 的 level 数字，也不把自然语言损益偷偷换算成总分。

`execute` 只按计划把任务下发给对应 OR；它不修改 OG 的层级、判据或指导。
资源预算、互斥关系和窗口策略属于 OPS 的 portfolio policy，不属于任何单个
OG。实现可以串行或受控并发，但必须保留计划顺序、终止保护和独立结果。

## 与现有 ProfessionalModel 的关系

现有 `ProfessionalModel` 是 OG 的首个已验证内核：

| 现有契约 | 新契约 |
| --- | --- |
| `ProfessionalModel.observe` | `ObjectiveGuide.probe` |
| `Problem.code` | `ObservedProblem.id` |
| `ProfessionalModel.guide` | `ObjectiveReferenceWiki.openProblem` 的单页静态基线 |
| `ProfessionalModel.describe` | `ObjectiveGuide.describeLevels` |
| 尚无对应能力 | `ObjectiveGuide.assessOutcome` |

Silvermoon 的 `whats-next` 已证明单目标观察和指导可以经过该内核，同时保留
报告、语言、控制权和精确 revision 语义。它不是 OR 或 OPS 的生产实现，也
不会因这份类型契约开始自动执行 skill、记录人工决定或协调多个 Objective。

本轮只把 OG、OR、OPS 与传输/装载边界写成可实施契约。后续实现必须在不破坏
现有导航行为的前提下演进类型，并分别证明单目标循环和多目标监督行为；单一
Silvermoon 场景仍不能证明该体系跨行业普适。
