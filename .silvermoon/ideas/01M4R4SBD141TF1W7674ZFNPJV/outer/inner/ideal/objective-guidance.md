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
| `ObjectiveLevelId` | 目标层级标识 | 与数组位置无关、用于 locale content 关联的稳定非空标识 |
| `LanguageTag` | 语言标记 | 经 canonicalize 的 BCP 47 内容语言标记 |
| `ObjectiveDomainSchema` | 目标定义域 Schema | Manifest 内描述 OG 可接受 subject 形状的 JSON Schema Draft 2020-12 object schema |
| `ObjectiveSubject` | 目标对象 | 定义域中的一个 JSON object 实例，例如某个 project 或具体 Idea |
| `JsonataExpression` | JSONata 表达式 | 受限、确定性地把当前 subject 投影为 prerequisite subject 的字符串 |
| `ObjectiveRuntimeContext` | 目标运行时上下文 | 发布窗口、预算等不属于 subject 身份的单次运行信息 |
| `ObjectiveContext` | 目标上下文 | 传给观测、指导、损益和调节过程的 subject 与 runtime 组合 |
| `ObservedProblem` | 已观测问题 | 一次观测中出现的问题 ID 与本次事实描述 |
| `ObjectiveObservation` | 目标观测 | OG 对当前 level、来源 Objective 与 subject、问题和总体 gap 的近似样本 |
| References | 参考知识集 | 按 language 提供的 OG 知识内容，由平级 reference pages 及其内部链接构成 |
| `ReferencePageId` | 参考页面标识 | 与文件路径无关的稳定非空页面 ID |
| `ReferencePageSummary` | 参考页面摘要 | Agent 搜索参考知识时取得的来源 Objective ID、页面 ID、标题与开放标签 |
| `ReferencePage` | 参考页面 | 已装载页面的入口声明、正文及其内部 reference links |
| `ObjectiveReferences` | 目标参考知识 | 绑定当前上下文并交给 Agent 主动打开问题、读取页面和搜索的查询接口 |
| `ObjectiveAdvancementAssessment` | 目标进阶损益 | 下一层标识与一段整体描述停留代价和进阶收益的 prompt |
| `ObjectiveOutcomeAssessment` | 目标损益评估 | 当前 level 及其可选下一层 advancement；最高层的 advancement 为 `null` |
| `ObjectiveLevelDescription` | 层级说明 | 已本地化的来源 Objective、稳定 level ID、序数、名称和含义 |
| Terminal level | 价值达成层 | 默认工厂在全部显式 advancement 通过后合成的唯一最高层；不进入 Manifest |
| OG transport unit | OG 传输单元 | 装载前承载 Manifest、代码与 reference pages 的 folder、package 或等价载体 |
| `ObjectiveGuideManifest` | 目标向导清单 | 传输单元内语言无关的身份、定义域、前置关系、显式层级和 localization 索引 |
| `ObjectiveLevelAdvancementManifest` | 层级进阶清单 | 从当前层进阶到下一层的 checks |
| `ObjectivePrerequisiteManifest` | 目标前置清单 | 声明当前 OG 的单个前置 Objective 及其 JSONata subject projection |
| `ObjectiveLevelManifest` | 显式层级清单项 | 尚未达成最终价值的层级及其必需 advancement |
| `ObjectiveLevelsManifest` | 显式层级序列 | 只含同型显式层级的非空 tuple；其后隐含 terminal level |
| `ObjectiveLocalizationManifest` | 本地化资源索引 | 某一 language 的 content 文件与 References 位置 |
| `ObjectiveGuideContentManifest` | 目标内容清单 | 某一 language 的 Objective 文本与按 level ID 索引的层级文本 |
| `ObjectiveLevelContentManifest` | 层级内容清单 | 某一 language 的 level 标题、说明与 outcome prompt |
| `ObjectiveTerminalContentManifest` | 价值达成内容 | 某一 language 对隐式 terminal 的固定语义标题和说明 |
| `CheckResult` | 检查结果 | 目标检查的通过结果，或带非空问题的未通过结果 |
| `ObjectiveCheck` | 目标检查 | 接收上下文与 resolved language、可执行且允许 IO 的单个层级进入判据 |
| `OutcomeAssessor` | 损益评估器 | 可依据本次观测、上下文与 resolved language 动态生成损益评估的装载绑定 |
| `ObjectiveGuideLoadBindings` | OG 装载绑定 | Loader 将 Manifest 中稳定 ID 连接到 checks、已解析 prerequisite guide 和动态实现 |
| `createObjectiveGuide` | OG 创建工厂 | 传输/装载边界使用的默认工厂；成功后只返回运行时 `ObjectiveGuide` |

### OR 与 OPS 术语

| 类型或术语 | 中文 | 定义 |
| --- | --- | --- |
| `RegulationLimits` | 调节限制 | 最大动作次数、总超时和连续无进展上限 |
| `ObjectiveActionRequest` | 目标行动请求 | OR 交给 Agent 的单步问题、Objective References、目标水位、观测与上下文 |
| `ObjectiveActionResult` | 目标行动结果 | Agent 对一次行动报告完成或阻塞；不直接证明 level 已改变 |
| `ObjectiveActionExecutor` | 目标行动执行器 | OR 用于请求 Agent 只执行一次现实动作的边界 |
| `RegulationRequest` | 调节请求 | 一轮 OR 调节的目标水位、上下文和保护限制 |
| `RegulationStatus` | 调节状态 | 目标达成或某种受控停止原因的判定值 |
| `RegulationResult` | 调节结果 | 状态、动作次数、目标水位与最新重新观测 |
| `ObjectiveSafetyThresholds` | 目标安全阈值 | 触发防御的最低水位与防御任务应恢复到的目标水位 |
| `ObjectiveRegistrationId` | 目标注册标识 | 一个 OG 与具体 subject 绑定后在 portfolio 内的稳定非空标识 |
| `ObjectiveRegistration` | 目标注册 | OPS 对 registration ID、OR、subject 和安全阈值的关联 |
| `ObjectivePortfolioEntry` | 目标组合条目 | 一个已注册 Objective 的 subject、观测、损益评估和安全阈值 |
| `ObjectivePortfolioObservation` | 目标组合观测 | 多个非原子目标样本组成的组合视图，不声称为瞬时快照 |
| `RegulationTrigger` | 调节触发来源 | 区分防御性任务与窗口驱动的进取性任务 |
| `RegulationDirective` | 调节指令 | OPS 按 registration ID 下发给某 OR 的目标水位、触发来源、理由和限制 |
| `DeferredObjective` | 延后目标 | 本轮未激活调节的 Objective registration 及其明确原因 |
| `ObjectivePortfolioPlan` | 目标组合计划 | 按优先级排列的调节指令与延后项 |
| `ObjectivePortfolioPolicy` | 目标组合策略函数 | 根据组合观测和上下文形成组合计划的跨目标策略 |
| `ObjectivePortfolioRunResult` | 目标组合运行结果 | OPS 执行计划后按 Objective 收集的 OR 结果 |

`Objective` 是一个可独立观测、具有有限有序层级的评价维度。`Portfolio`
只表达由 OPS 管理的一组 Objective，不引入业务 Domain 聚合或要求独立
Portfolio 实体。Objective 的数学定义域只约束可接受 subject，与此前放弃的
`DomainSupervisor` 命名无关。公开类型不使用势场、势能等物理隐喻。

层级是单个 Objective 内的序数，不表示等距收益，也不能跨 Objective 直接
相加比较。最高层级唯一，但满足该层的现实状态可以有多个。系统允许长期停留
在中间层级并承担相应代价；本轮是否提升以及提升到哪一层由 OPS 决定。

## 命名评注

以下结论用于稳定当前候选：

| 名称 | 当前结论 | 说明 |
| --- | --- | --- |
| `ObjectiveObservation` | 采用 | 明确表达目标维度的非原子观测，避免泛化的结果或瞬时快照语义 |
| `CheckId` / `ObjectiveCheck` | 采用 | 检查允许 IO 并返回问题；`Assertion` 容易被误解为测试断言或抛错 |
| `RegulationStatus` | 采用 | 同时包含 `target-reached` 和停止原因，比 `Termination` 更中性 |
| `RegulationTrigger` | 采用 | `defensive` / `opportunistic` 表达任务来源，比泛化的 `Reason` 更准确 |
| `ObjectiveRegulator` | 保留 | `Restorer` 不能表达首次提升，`Controller` 又暗示直接控制现实；Regulator 同时覆盖恢复、维持和提升 |
| `ObjectivePortfolioSupervisor` | 保留 | 名称较长但准确表达多目标组合监督；代码使用全名，`OPS` 只用于文档简称 |
| `ObjectiveGuideManifest` | 保留 | 所在章节已明确其传输属性；只有出现多种 Manifest 冲突时才考虑 `ObjectiveGuideTransportManifest` |
| `ObjectiveSubject` / `ObjectiveRuntimeContext` | 采用 | Project 与 Idea 定义域证明对象身份和单次运行信息生命周期不同；`ObjectiveContext` 只作为两者的组合参数 |
| `ObjectivePrerequisiteManifest` | 采用 | Project 整备属于 Idea 语义前缀时声明为单个 prerequisite；Loader 组合其 levels，但公共概念不暴露装载机制 |

## 公共基础类型

```ts
type ObjectiveId = string;
type ProblemId = string;
type CheckId = string;
type ObjectiveLevel = number;
type ObjectiveLevelId = string;
type ObjectiveRegistrationId = string;
type ReferencePageId = string;
type JsonataExpression = string;
type LanguageTag = string;

type JsonValue =
  | string
  | number
  | boolean
  | null
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

type JsonObject = Readonly<Record<string, JsonValue>>;
type ObjectiveDomainSchema = JsonObject;
type ObjectiveSubject = JsonObject;
type ObjectiveRuntimeContext = Readonly<Record<string, unknown>>;

interface ObjectiveContext {
  subject: ObjectiveSubject;
  runtime: ObjectiveRuntimeContext;
}

interface ObservedProblem {
  id: ProblemId;
  description: string;
}

interface ObjectiveObservation {
  sourceObjectiveId: ObjectiveId;
  sourceSubject: ObjectiveSubject;
  level: ObjectiveLevel;
  problems: readonly ObservedProblem[];
  gapSummary: string;
}

interface ReferencePageSummary {
  sourceObjectiveId: ObjectiveId;
  id: ReferencePageId;
  title: string;
  tags: readonly string[];
}

interface ReferencePage extends ReferencePageSummary {
  problemIds: readonly ProblemId[];
  unknownProblemFallback: boolean;
  content: string;
  links: readonly ReferencePageId[];
}

interface ObjectiveReferences {
  openProblem(
    sourceObjectiveId: ObjectiveId,
    problemId: ProblemId,
  ): Promise<ReferencePage>;
  readPage(
    sourceObjectiveId: ObjectiveId,
    pageId: ReferencePageId,
  ): Promise<ReferencePage>;
  search(query: string): Promise<readonly ReferencePageSummary[]>;
}

interface ObjectiveAdvancementAssessment {
  nextLevel: ObjectiveLevel;
  prompt: string;
}

interface ObjectiveOutcomeAssessment {
  level: ObjectiveLevel;
  advancement: ObjectiveAdvancementAssessment | null;
}

interface ObjectiveLevelDescription {
  sourceObjectiveId: ObjectiveId;
  id: ObjectiveLevelId;
  level: ObjectiveLevel;
  title: string;
  description: string;
}
```

`ObjectiveId`、`ProblemId`、`CheckId` 与 `ReferencePageId` 必须非空且在所属
OG 内稳定；`ObjectiveRegistrationId` 必须非空且在所属 portfolio 内稳定。
`ObjectiveLevelId` 必须非空且在所属 source OG 内稳定，由
`sourceObjectiveId` 消歧；组合 terminal 使用当前 Guide 的 Objective ID 和
保留 ID `terminal`。层级是从 0 开始的连续非负整数。
`ObjectiveSubject` 只含 JSON 数据并必须满足当前 OG 的 `domainSchema`；
`ObjectiveRuntimeContext` 不参与定义域验证，也不应被当作 subject 身份持久化。
`ObjectiveObservation.sourceObjectiveId` 与 `sourceSubject` 标明本次层级和
问题由当前 OG 还是某个 prerequisite OG、针对哪个投影后 subject 产生；
`problems` 按该来源 OG 建议的处理顺序排列，第一个问题是 OR 默认选择的下一
处置对象。达到最高层级时问题列表可以为空，
`gapSummary` 仍需给出简短结论。证据不足时 OG 返回它能支持的层级，并用
问题明确表达知识缺口，不能把近似样本伪装成现实真值。

`ObjectiveReferences.openProblem` 根据 source Objective 与 `problemId` 返回
对应入口页面；
未知问题返回唯一的 `unknownProblemFallback` 页面。Agent 可以按需调用
`readPage` 在同一 source 内沿内部链接阅读，或用 `search` 主动查找带来源的页面。
参考知识查询次数、分页
和 Agent token 预算属于通用执行环境限制，不进入 OG Manifest 的领域语义。

最高层没有下一条边，因此 `ObjectiveOutcomeAssessment.advancement` 为 `null`。
转换损益保持语义化，不把序数层级伪装成可跨目标求和的效用分数。

## ObjectiveGuide

```ts
interface ObjectiveGuide {
  readonly id: ObjectiveId;
  readonly language: LanguageTag;
  readonly title: string;
  readonly description: string;
  readonly domainSchema: ObjectiveDomainSchema;

  describeLevels(): readonly ObjectiveLevelDescription[];

  probe(ctx: ObjectiveContext): Promise<ObjectiveObservation>;

  openReferences(
    ctx: ObjectiveContext,
  ): Promise<ObjectiveReferences>;

  assessOutcome(
    observation: ObjectiveObservation,
    ctx: ObjectiveContext,
  ): Promise<ObjectiveOutcomeAssessment>;
}
```

`probe` 是定向现实探测，允许 IO 和观测扰动，也可能经历时序撕裂。它不执行
现实修改，不保证事务性原子快照。每个公开操作先确认 `ctx.subject` 满足
`domainSchema`；定义域错误必须 reject，不能伪装成低 level 或业务问题。
`openReferences` 只把当前上下文绑定到
参考知识查询接口，不替 Agent 选择、预取或裁剪知识。Agent 收到问题后主动打开
入口页面并按需阅读；未知 `problemId` 必须落到明确的知识缺口页面，不能伪装
成已知解法。

OG 只说明怎么看、问题怎么处理以及不同层级的损益。它不调用 Agent、不循环
修复，也不替代权限、人工接受或外部决定。

## OG 传输与装载规范

OG 可以通过 folder、package、数据库记录或其他可加载单元传输。它们只是
装载前的传输格式，不是运行时 OG。典型本地传输把原先分离的 guidance 和
docs 统一为相互链接的 reference pages；页面平级存放，目录层级不表达节点种类：

```text
my-objective-guide/
├── objective-guide.yaml
├── index.ts
├── checks/
├── locales/
│   ├── zh-CN.yaml
│   └── en-US.yaml
└── references/
    ├── zh-CN/
    │   ├── repository-not-ready.md
    │   └── setup-runtime.md
    └── en-US/
        ├── repository-not-ready.md
        └── setup-runtime.md
```

Manifest 是传输单元内可序列化的静态描述符和资源索引，不等于运行时 OG。
代码、locale content、reference pages 和 Manifest 一起构成传输单元；npm 只是可选分发载体，
不是模型概念。Reference pages 通过 frontmatter 声明稳定 ID、零到多个 ProblemId、
开放 tags 和未知问题兜底角色，通过内部 reference links 相互引用。Loader 负责枚举
页面、解析链接并绑定代码，成功后只返回 `ObjectiveGuide`。业务代码、OR 与
OPS 不接收 Manifest、路径或页面资源布局。

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
入口语义。内部 reference link 使用稳定页面 ID，文件名和目录不是节点身份。

```ts
interface ObjectiveLevelAdvancementManifest {
  checks: readonly CheckId[];
}

interface ObjectivePrerequisiteManifest {
  objectiveId: ObjectiveId;
  subject: JsonataExpression;
}

interface ObjectiveLevelManifest {
  id: ObjectiveLevelId;
  advancement: ObjectiveLevelAdvancementManifest;
}

type ObjectiveLevelsManifest = readonly [
  ObjectiveLevelManifest,
  ...ObjectiveLevelManifest[],
];

interface ObjectiveLevelContentManifest {
  title: string;
  description: string;
  outcome: string;
}

interface ObjectiveTerminalContentManifest {
  title: string;
  description: string;
}

interface ObjectiveGuideContentManifest {
  title: string;
  description: string;
  terminal: ObjectiveTerminalContentManifest;
  levels: Readonly<
    Record<ObjectiveLevelId, ObjectiveLevelContentManifest>
  >;
}

interface ObjectiveLocalizationManifest {
  content: string;
  references: string;
}

interface ObjectiveGuideManifest {
  schemaVersion: 1;
  id: ObjectiveId;
  domainSchema: ObjectiveDomainSchema;
  prerequisite?: ObjectivePrerequisiteManifest;
  levels: ObjectiveLevelsManifest;
  defaultLanguage: LanguageTag;
  localizations: Readonly<
    Record<LanguageTag, ObjectiveLocalizationManifest>
  >;
}

type CheckResult =
  | { pass: true }
  | { pass: false; problems: readonly [ObservedProblem, ...ObservedProblem[]] };

type ObjectiveCheck = (
  ctx: ObjectiveContext,
  language: LanguageTag,
) => Promise<CheckResult>;

type OutcomeAssessor = (
  observation: ObjectiveObservation,
  ctx: ObjectiveContext,
  language: LanguageTag,
) => Promise<ObjectiveOutcomeAssessment>;

interface ObjectiveGuideLoadBindings {
  checks: Readonly<Record<CheckId, ObjectiveCheck>>;
  guides?: Readonly<Record<ObjectiveId, ObjectiveGuide>>;
  assessOutcome?: OutcomeAssessor;
}

interface CreateObjectiveGuideOptions {
  language?: LanguageTag;
}

// Transport-layer factory; runtime consumers use only the returned guide.
declare function createObjectiveGuide(
  manifest: ObjectiveGuideManifest,
  bindings: ObjectiveGuideLoadBindings,
  options?: CreateObjectiveGuideOptions,
): ObjectiveGuide;
```

对应的 YAML Manifest 只声明语言无关的身份、定义域、本地 level IDs 与
checks、可选 prerequisite projection，以及每种 language 的内容资源位置：

```yaml
schemaVersion: 1
id: repository-readiness
domainSchema:
  $schema: https://json-schema.org/draft/2020-12/schema
  type: object
  properties:
    projectId:
      type: string
      minLength: 1
  required:
    - projectId
  additionalProperties: false
levels:
  - id: unavailable
    advancement:
      checks:
        - project-valid
        - repository-ready
defaultLanguage: zh-CN
localizations:
  zh-CN:
    content: locales/zh-CN.yaml
    references: references/zh-CN
  en-US:
    content: locales/en-US.yaml
    references: references/en-US
```

Idea 级 OG 可以把仓库整备 levels 作为语义前缀，并显式生成 prerequisite subject：

```yaml
schemaVersion: 1
id: idea-progress
domainSchema:
  $schema: https://json-schema.org/draft/2020-12/schema
  type: object
  properties:
    projectId:
      type: string
      minLength: 1
    ideaId:
      type: string
      minLength: 1
  required:
    - projectId
    - ideaId
  additionalProperties: false
prerequisite:
  objectiveId: repository-readiness
  subject: |
    {
      "projectId": projectId
    }
levels:
  - id: undefined
    advancement:
      checks:
        - idea-defined
defaultLanguage: zh-CN
localizations:
  zh-CN:
    content: locales/zh-CN.yaml
    references: references/zh-CN
  en-US:
    content: locales/en-US.yaml
    references: references/en-US
```

每个 `content` 文件提供该 language 的完整文本，而不复制结构语义。例如上面的
`repository-readiness` 可以有：

```yaml
title: 仓库整备度
description: 在事实已经得到验证的项目和仓库基础上安全开展工作
terminal:
  title: 价值达成
  description: 所追求的仓库整备价值已经达到顶层
levels:
  unavailable:
    title: 尚不可用
    description: 尚无足够证据确认仓库可以开展工作
    outcome: >
      停留在当前层意味着无法安全推进依赖仓库事实的工作；进入价值达成层后，
      可以在已确认的项目与仓库基础上开展工作。
```

`content` 和 `references` 都相对 Manifest 解析。默认工厂只支持这一种 Markdown
reference-page 序列化，不通过 `format` 提供多种协议选择；其他载体应由手写
OG 自行适配，而不是扩大默认 Manifest。每个 `references` 只定位对应 language
的完整页面集合，不规定页面文件名、子目录或领域分类；问题入口和页面链接仍
由 reference pages 自身声明。

locale content 的顶层 `description` 说明 OG 最终追求的价值状态。`domainSchema` 描述这个
OG 可以观测的 `ObjectiveSubject` 集合，例如 project 级 OG 只要求 project
身份，而 Idea 级 OG 同时要求 project 与 Idea 身份。默认工厂固定使用 JSON
Schema Draft 2020-12，根 schema 必须描述 object；只解析 `#/$defs/...` 本地
引用，不隐式访问远端，也不执行 coercion 或用 `default` 改写 subject。

`prerequisite` 是带参数的语义前置关系，不是无参文件 include；`subject` 本身
就是 JSONata expression，不再包一层语言字段或并存另一套 mapping DSL。表达式
只以当前 subject 为根输入，不能读取 runtime、环境变量、文件或网络，也不能
调用注册扩展。以上例子把 `{ projectId, ideaId }` 投影为 `{ projectId }`；
生成结果必须是普通 JSON object，并先通过
`repository-readiness.domainSchema`，然后 prerequisite guide 才能 probe。
解析或执行失败、非 JSON 输出、缺失值、非确定性行为或定义域不匹配都必须
reject，不能伪装成 level 0。Prerequisite guide 接收投影后的 subject 与原样
传递的 runtime；language 已由同语言的 prerequisite Guide 绑定。

`levels` 只声明尚未达到该价值的本地显式层级，不重复保存数字；每一项都有
稳定、局部唯一且不等于保留字 `terminal` 的 ID，并且必须带有 advancement。
locale content 必须按这些 ID 恰好提供一份完整文本，不得缺失或增加 level。
设递归 prerequisite chain 合计贡献 `prerequisiteLevelCount`
个显式 level，则 `levels[i]` 的组合 level 是 `prerequisiteLevelCount + i`。最后一个本地
advancement 指向默认工厂合成的 terminal，terminal level 固定为
`prerequisiteLevelCount + levels.length`。没有 prerequisite 时自然退化为
`levels.length`。Terminal 的机器语义名为 `terminal`，人类展示名称可本地化为
“价值达成”，统一表示 locale content 顶层 `description` 所述目标已经达成；
locale content 的 `terminal` 只提供这一隐式层的语言表达，不会把它变成带
checks 或 advancement 的 Manifest level。

`ObjectiveLevelsManifest` 用非空 tuple 排除没有判据、天然处于 terminal 的空
向导。空 checks 的 advancement 仍可自然进阶。默认工厂从 0 层开始逐级、逐关
检查，首个未通过处形成观测；全部显式 advancement 通过后才返回 terminal level。
Manifest 只保存稳定 check ID，folder 或 package 中的 load bindings 提供对应
代码，因此同一契约可由 YAML、JSON 或 TypeScript 数据表达，而不要求序列化
函数。`levels[id].outcome` 是一段非空 prompt，同时描述接受当前层的代价与
进入下一层的收益；它按 level ID 存放在 locale content 中，框架不解析其内部
格式，也不要求作者拆成两个字段。

`createObjectiveGuide` 将 language 解析一次并绑定到返回的运行时 Guide。
调用方未指定 `options.language` 时使用 `defaultLanguage`；显式指定时必须存在
完全匹配的 canonical BCP 47 key，否则装载失败。默认工厂不做 language range、
父语言或字段级 fallback，也不会把两种 language 的字段拼成一个 Guide。
每个 localization 都必须完整提供 Objective 文本、terminal 文本、全部 level
文本和 References。默认工厂把 Guide 绑定的 resolved language 显式传给
checks 与动态 assessor；Reference search 也只返回该 language 的内容。运行时
调用方不在每次 `ObjectiveContext` 中重复选择 language。

默认工厂递归展开 prerequisite chain 的显式 levels，再拼接本地 levels，最后
只为完整组合生成一个 terminal。Prerequisite guide 自己的 terminal 不进入
组合；其 terminal 边界与当前 guide 的本地 level 0 合并。Probe 先调用
prerequisite guide：只要它尚未 terminal，就映射其 level offset，保留
`sourceObjectiveId` 与问题并立即返回，不运行任何本地 check。Prerequisite
terminal 后才探测本地 levels。`describeLevels`、动态 outcome 和 `nextLevel`
使用相同 offset；组合 `ObjectiveReferences` 根据
`sourceObjectiveId` 将问题和页面查询路由回来源 guide。
整条 prerequisite chain 必须解析为同一 language；任何 source OG 缺少该
localization，或者 `ObjectiveGuideLoadBindings.guides` 中的 Guide language
不一致，都必须拒绝组合，而不是局部回退到其默认语言。

Loader 必须在每个 source OG 内拒绝重复页面 ID、同一 ProblemId 的重复入口、
多个未知问题兜底、悬空内部链接与空页面；不同 source 可以复用局部 ID，由
`sourceObjectiveId` 消歧。它不按目录或 tags 推断语义。Reference links 允许环，
也允许一个页面处理多个问题或由多个问题入口共同引用。默认工厂装载这一种
页面集合并通过 `openReferences` 暴露主动查询接口；它不按深度或页面数量替
Agent 预取知识。同一 OG 的各 localization 必须保留相同的 page IDs、
ProblemId 入口映射、unknown fallback 角色与内部链接目标；标题、正文与 tags
可以本地化。Load bindings 仍可提供动态 assessor，例如依据发布窗口和 language
改变损益描述。

对 YAML、JSON 等外部数据，Loader 必须先验证 `domainSchema` 自身有效，再验证
`levels` 非空、level IDs 唯一、每项都有合法 advancement，并拒绝保留 ID
`terminal`、显式 terminal item 或 `advancement: null`。因为数组中不再混入
不同类型的最后一项，标准 JSON Schema 可以用 `minItems: 1` 和统一的 `items`
schema 完整表达其结构。Loader 还必须验证所有 language keys 是无歧义的
canonical BCP 47 tags、`defaultLanguage` 存在，并确认每个 content 中的标题、
说明和 outcome 都非空且 level ID 集合与 Manifest 精确相等。Loader 还必须
解析 prerequisite guide，拒绝
未知 Objective ID、自引用与递归 prerequisite 环。Loader 在装载时解析并编译
JSONata，使用由 `schemaVersion` 固定的受限 profile：不允许动态求值、自定义
函数、递归以及时间或随机函数，并限制表达式长度、AST 深度、执行时间和输出
大小。单个 optional prerequisite 递归形成确定的全序链；第一版不接受会引入
任意排序的多个独立 prerequisites。
`ObjectiveGuideLoadBindings.guides` 只提供已经解析的运行时 guides；传输载体
怎样定位 folder 或 package 仍不是模型概念。
`createObjectiveGuide` 属于装载边界，其参数不会泄漏到运行时协作接口。高级
传输单元仍保留 Manifest 用于身份与发现，但可以使用自定义 loader 直接产出
手写 `ObjectiveGuide`，绕过默认探测和 reference pages 装载。

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
  references: ObjectiveReferences;
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
`targetLevel`；选择首个问题并把 Objective References 作为查询工具交给 Agent；
Agent 主动查阅知识后只执行一次现实动作；然后框架重新探测。参考知识查询属于
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
  id: ObjectiveRegistrationId;
  regulator: ObjectiveRegulator;
  subject: ObjectiveSubject;
  safety: ObjectiveSafetyThresholds;
}

interface ObjectivePortfolioEntry {
  registrationId: ObjectiveRegistrationId;
  objectiveId: ObjectiveId;
  subject: ObjectiveSubject;
  observation: ObjectiveObservation;
  outcome: ObjectiveOutcomeAssessment;
  safety: ObjectiveSafetyThresholds;
}

interface ObjectivePortfolioObservation {
  entries: readonly ObjectivePortfolioEntry[];
}

type RegulationTrigger = "defensive" | "opportunistic";

interface RegulationDirective {
  registrationId: ObjectiveRegistrationId;
  targetLevel: ObjectiveLevel;
  trigger: RegulationTrigger;
  rationale: string;
  limits: RegulationLimits;
}

interface DeferredObjective {
  registrationId: ObjectiveRegistrationId;
  reason: string;
}

interface ObjectivePortfolioPlan {
  directives: readonly RegulationDirective[];
  deferred: readonly DeferredObjective[];
}

type ObjectivePortfolioPolicy = (
  observation: ObjectivePortfolioObservation,
  runtime: ObjectiveRuntimeContext,
) => Promise<ObjectivePortfolioPlan>;

interface ObjectivePortfolioRunResult {
  results: readonly {
    registrationId: ObjectiveRegistrationId;
    result: RegulationResult;
  }[];
}

interface ObjectivePortfolioSupervisor {
  observe(
    runtime: ObjectiveRuntimeContext,
  ): Promise<ObjectivePortfolioObservation>;

  plan(
    observation: ObjectivePortfolioObservation,
    runtime: ObjectiveRuntimeContext,
  ): Promise<ObjectivePortfolioPlan>;

  execute(
    plan: ObjectivePortfolioPlan,
    runtime: ObjectiveRuntimeContext,
    executeAction: ObjectiveActionExecutor,
  ): Promise<ObjectivePortfolioRunResult>;
}
```

同一个 OG 可以绑定多个 subject，因此 portfolio 内的实例识别和调度都引用
`ObjectiveRegistrationId`，不能只引用 `ObjectiveId`。OPS 的 `observe` 为每个
registration 组合其 `subject` 与本轮 `runtime`，让各 OR 仅探测，并调用其 OG
的 `assessOutcome`。所得向量是多个现实样本的组合，不宣称为同一时刻的原子
快照。

Registration 创建时必须先用 OG 的 `domainSchema` 验证 subject。Project 整备
若属于 Idea Objective 的定义，不由 OPS 建立两个 registration 之间的前置门槛；
Idea OG 通过 `prerequisite` 组合 Project levels，并在 prerequisite terminal
前自行短路 probe。OPS 只看组合后的 Idea OG。

`plan` 先处理跌破
`defensiveThreshold` 的防御任务，再由 portfolio policy 在剩余预算和窗口中
决定进取任务、顺序与延后项。`directives` 的数组顺序表达调度优先级，不比较
不同 Objective 的 level 数字，也不把自然语言损益偷偷换算成总分。

`execute` 只按计划把任务下发给对应 OR；它不修改 OG 的层级、判据或指导。
资源预算、互斥关系和窗口策略属于 OPS 的 portfolio policy，不属于任何单个
OG。跨 Objective 的知识链接仍属于 References，语义前置组合属于
`prerequisite`，单层现实判据属于 checks；OPS 不重写这些关系。实现可以串行
或受控并发，但必须保留计划顺序、终止保护和独立结果。

## 与现有 ProfessionalModel 的关系

现有 `ProfessionalModel` 是 OG 的首个已验证内核：

| 现有契约 | 新契约 |
| --- | --- |
| `ProfessionalModel.observe` | `ObjectiveGuide.probe` |
| `Problem.code` | `ObservedProblem.id` |
| `ProfessionalModel.guide` | `ObjectiveReferences.openProblem` 的单页静态基线 |
| `ProfessionalModel.describe` | `ObjectiveGuide.describeLevels` |
| 尚无对应能力 | `ObjectiveGuide.assessOutcome` |

Silvermoon 的 `whats-next` 已证明单目标观察和指导可以经过该内核，同时保留
报告、语言、控制权和精确 revision 语义。它不是 OR 或 OPS 的生产实现，也
不会因这份类型契约开始自动执行 skill、记录人工决定或协调多个 Objective。

本轮只把 OG、OR、OPS 与传输/装载边界写成可实施契约。后续实现必须在不破坏
现有导航行为的前提下演进类型，并分别证明单目标循环和多目标监督行为；单一
Silvermoon 场景仍不能证明该体系跨行业普适。
