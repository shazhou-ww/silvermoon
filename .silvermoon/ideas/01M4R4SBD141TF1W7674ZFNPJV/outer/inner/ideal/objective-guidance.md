# Objective Guidance 类型体系

## 公开术语

| 简称 | 英文 | 中文 | 责任 |
| --- | --- | --- | --- |
| OG | ObjectiveGuide | 目标向导 | 封装单一目标维度的观测、问题指导与层级损益知识 |
| OR | ObjectiveRegulator | 目标调节器 | 持有一个 OG，执行单目标探测、单步行动与复测闭环 |
| OPS | Objective Portfolio Supervisor | 目标组合监督器 | 监督多个 OR，采集状态、守住阈值并进行资源取舍 |

`Objective` 是一个可独立观测、具有有限有序层级的评价维度。`Portfolio`
只表达由 OPS 管理的一组 Objective，不引入额外 Domain 概念或要求独立
Portfolio 实体。公开类型不使用势场、势能等物理隐喻。

层级是单个 Objective 内的序数，不表示等距收益，也不能跨 Objective 直接
相加比较。最高层级唯一，但满足该层的现实状态可以有多个。系统允许长期停留
在中间层级并承担相应代价；本轮是否提升以及提升到哪一层由 OPS 决定。

## 公共基础类型

```ts
type ObjectiveId = string;
type ProblemId = string;
type AssertionId = string;
type ObjectiveLevel = number;
type ObjectiveContext = Readonly<Record<string, unknown>>;

interface ObservedProblem {
  id: ProblemId;
  description: string;
}

interface ObservationResult {
  level: ObjectiveLevel;
  problems: readonly ObservedProblem[];
  gapSummary: string;
}

interface Guidance {
  title: string;
  suggestion: string;
  references: readonly string[];
}

interface OutcomeAssessment {
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
`ObservationResult.problems` 按 OG 建议的处理顺序排列；第一个问题是 OR
默认选择的下一处置对象。达到最高层级时问题列表可以为空，
`gapSummary` 仍需给出简短结论。证据不足时 OG 返回它能支持的层级，并用
问题明确表达知识缺口，不能把近似样本伪装成现实真值。

`nextLevel` 和 `nextLevelBenefit` 在最高层级为 `null`。损益字段保持语义化，
不把序数层级伪装成可跨目标求和的效用分数。

## ObjectiveGuide

```ts
interface ObjectiveGuide {
  readonly id: ObjectiveId;

  describeLevels(): readonly ObjectiveLevelDescription[];

  probe(ctx: ObjectiveContext): Promise<ObservationResult>;

  resolveGuidance(
    problemId: ProblemId,
    observation: ObservationResult,
    ctx: ObjectiveContext,
  ): Promise<Guidance>;

  assessOutcome(
    observation: ObservationResult,
    ctx: ObjectiveContext,
  ): Promise<OutcomeAssessment>;
}
```

`probe` 是定向现实探测，允许 IO 和观测扰动，也可能经历时序撕裂。它不执行
现实修改，不保证事务性原子快照。`resolveGuidance` 接收本次完整观测，动态
实现无需为取得问题事实而再次探测。未知 `problemId` 必须返回明确的知识缺口
指导或抛出契约规定的配置错误，不能伪装成已知解法。

OG 只说明怎么看、问题怎么处理以及不同层级的损益。它不调用 Agent、不循环
修复，也不替代权限、人工接受或外部决定。

## OG 传输与装载规范

OG 可以通过 folder、package、数据库记录或其他可加载单元传输。它们只是
装载前的传输格式，不是运行时 OG。典型传输目录可以同时包含静态声明、代码
和文档：

```text
my-objective-guide/
├── objective-guide.yaml
├── index.ts
├── assertions/
├── guidance/
└── docs/
```

Manifest 是传输单元内可序列化的静态描述符和资源索引，不等于运行时 OG。
代码、动态查询和文档与 Manifest 一起构成传输单元；npm 只是可选分发载体，
不是模型概念。Loader 负责校验传输内容、解析资源和绑定代码，成功后只返回
`ObjectiveGuide`。业务代码、OR 与 OPS 不接收 Manifest、路径或资源布局。

```ts
interface StaticOutcomeDescription {
  currentCost: string;
  nextLevelBenefit: string | null;
}

interface ObjectiveLevelManifest {
  level: ObjectiveLevel;
  title: string;
  description: string;
  entryAssertions: readonly AssertionId[];
  outcome: StaticOutcomeDescription;
}

interface ProblemCatalogEntry {
  title: string;
  guidance: Guidance;
}

interface ObjectiveGuideManifest {
  schemaVersion: 1;
  id: ObjectiveId;
  title: string;
  levels: readonly ObjectiveLevelManifest[];
  problemCatalog: Readonly<Record<ProblemId, ProblemCatalogEntry>>;
}

type AssertionResult =
  | { pass: true }
  | { pass: false; problems: readonly [ObservedProblem, ...ObservedProblem[]] };

type ObjectiveAssertion = (
  ctx: ObjectiveContext,
) => Promise<AssertionResult>;

type GuidanceResolver = (
  problemId: ProblemId,
  observation: ObservationResult,
  ctx: ObjectiveContext,
) => Promise<Guidance>;

type OutcomeAssessor = (
  observation: ObservationResult,
  ctx: ObjectiveContext,
) => Promise<OutcomeAssessment>;

interface ObjectiveGuideLoadBindings {
  assertions: Readonly<Record<AssertionId, ObjectiveAssertion>>;
  resolveGuidance?: GuidanceResolver;
  assessOutcome?: OutcomeAssessor;
}

// Transport-layer factory; runtime consumers use only the returned guide.
declare function createObjectiveGuide(
  manifest: ObjectiveGuideManifest,
  bindings: ObjectiveGuideLoadBindings,
): ObjectiveGuide;
```

0 层的 `entryAssertions` 为空；每个后续层级的断言表示进入该层必须成立的
条件。默认工厂从 0 层开始逐级、逐关检查，首个未通过处形成观测。Manifest
只保存稳定 assertion ID，folder 或 package 中的 load bindings 提供对应代码；
因此同一契约可由 YAML、JSON 或 TypeScript 数据表达，而不要求序列化函数。

默认 guidance 和损益取自 Manifest。Load bindings 可以提供动态 resolver 或
assessor，例如依据发布窗口改变损益描述。`createObjectiveGuide` 属于装载
边界，其参数不会泄漏到运行时协作接口。高级传输单元仍保留 Manifest 用于
身份与发现，但可以使用自定义 loader 直接产出手写 `ObjectiveGuide`，绕过
默认探测拼装。

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
  observation: ObservationResult;
  problem: ObservedProblem;
  guidance: Guidance;
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

type RegulationTermination =
  | "target-reached"
  | "no-actionable-problem"
  | "action-blocked"
  | "no-progress"
  | "max-iterations"
  | "timed-out";

interface RegulationResult {
  termination: RegulationTermination;
  targetLevel: ObjectiveLevel;
  iterations: number;
  latestObservation: ObservationResult;
}

interface ObjectiveRegulator {
  readonly guide: ObjectiveGuide;

  probe(ctx: ObjectiveContext): Promise<ObservationResult>;

  regulate(
    request: RegulationRequest,
    executeAction: ObjectiveActionExecutor,
  ): Promise<RegulationResult>;
}
```

`probe` 是仅探测入口：它不会调用 Agent，但仍可能产生 OG 探测固有的 IO、
成本和扰动。`regulate` 的生产语义由框架持有循环：探测；判断是否达到
`targetLevel`；选择首个问题并取得 guidance；让 Agent 只执行一次动作；
然后重新探测。Agent 不在 prompt 内自行维持循环。

OR 不强制追求最高层，只到达本轮目标水位。迭代数是已请求的 Agent 动作次数；
Agent 报告 `completed` 不构成进展证据，新的 `probe` 才能确认状态。受控停止
使用 `RegulationTermination`；配置错误、探测缺陷或未建模的执行异常明确
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

interface ObjectivePortfolioItem {
  objectiveId: ObjectiveId;
  observation: ObservationResult;
  outcome: OutcomeAssessment;
  safety: ObjectiveSafetyThresholds;
}

interface ObjectivePortfolioSnapshot {
  items: readonly ObjectivePortfolioItem[];
}

type RegulationReason = "defensive" | "opportunistic";

interface RegulationDirective {
  objectiveId: ObjectiveId;
  targetLevel: ObjectiveLevel;
  reason: RegulationReason;
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
  snapshot: ObjectivePortfolioSnapshot,
  ctx: ObjectiveContext,
) => Promise<ObjectivePortfolioPlan>;

interface ObjectivePortfolioRunResult {
  results: readonly {
    objectiveId: ObjectiveId;
    result: RegulationResult;
  }[];
}

interface ObjectivePortfolioSupervisor {
  observe(ctx: ObjectiveContext): Promise<ObjectivePortfolioSnapshot>;

  plan(
    snapshot: ObjectivePortfolioSnapshot,
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
| `ProfessionalModel.guide` | `ObjectiveGuide.resolveGuidance` 的静态基线 |
| `ProfessionalModel.describe` | `ObjectiveGuide.describeLevels` |
| 尚无对应能力 | `ObjectiveGuide.assessOutcome` |

Silvermoon 的 `whats-next` 已证明单目标观察和指导可以经过该内核，同时保留
报告、语言、控制权和精确 revision 语义。它不是 OR 或 OPS 的生产实现，也
不会因这份类型契约开始自动执行 skill、记录人工决定或协调多个 Objective。

本轮只把 OG、OR、OPS 与传输/装载边界写成可实施契约。后续实现必须在不破坏
现有导航行为的前提下演进类型，并分别证明单目标循环和多目标监督行为；单一
Silvermoon 场景仍不能证明该体系跨行业普适。
