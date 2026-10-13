# Objective Guidance 类型体系

## 模型边界

| 构件 | 职责 |
| --- | --- |
| ObjectiveLoader | 以 Manifest URI 解析、缓存并递归组合 language-bound ObjectiveGuide |
| ObjectiveGuide（OG） | 定义单一 Objective 怎么观测、问题怎么处理、层级进阶有什么损益 |
| ObjectiveRegulator（OR） | 持有一个 OG，执行探测、Agent 单步行动、复测和终止保护 |
| Objective Portfolio Supervisor（OPS） | 监督多个 subject-bound OR，采集组合观测并做阈值、资源和时机取舍 |
| Agent | 根据现状和 References 执行一次现实动作，不自行维持 OR 循环 |

- `ObjectiveLevel` 是单个 Objective 内从 0 开始的序数，不能跨 Objective
  相加或比较；系统可以长期停留在中间层。
- `probe` 是允许 IO、成本、扰动和时序撕裂的现实采样，不是原子快照。
- OG 只提供感知、参考知识和损益评估，现实修改全部由 Agent 完成。
- Folder、package、Manifest 和 reference pages 只是传输形式；Loader 是装载与
  identity-map 边界，其他运行时构件只协作 `ObjectiveGuide`。
- 势场术语只用于[理论溯源](./value-field-reasoning.md)，不进入公共 API。

## 公共基础类型

```ts
type ObjectiveManifestUri = string;
type CheckId = string;
type ObjectiveRegistrationId = string;
type ReferencePageId = string;
type JsonataExpression = string;
type LanguageTag = string; // canonical BCP 47

type ObjectiveLevel = number; // 从 0 开始的连续序数
type ObjectiveLevelId = string; // owning Guide 内稳定；不依赖数组位置

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

interface ObservedProblem {
  // pageId 同时是稳定问题入口；同一 page 可服务多个具体问题。
  pageId: ReferencePageId;
  description: string;
}

interface ReferencePageSummary {
  id: ReferencePageId;
  title: string;
  tags: readonly string[];
}

interface ReferencePage extends ReferencePageSummary {
  unknownProblemFallback: boolean;
  content: string;
  links: readonly ReferencePageId[];
}

interface ObjectiveAdvancementDescription {
  // 单段 prompt 同时描述停留代价和进阶收益。
  outcome: string;
}

interface ObjectiveLevelDescription {
  // prerequisite level 直接引用实际负责观测与 page 查询的 Guide。
  guide: ObjectiveGuide;
  id: ObjectiveLevelId;
  level: ObjectiveLevel;
  title: string;
  description: string;
  // 数组下一项就是目标层；terminal 为 null。
  advancement: ObjectiveAdvancementDescription | null;
}

interface ObjectiveObservation {
  // prerequisite 未通过时，这里是投影后的 prerequisite subject。
  subject: ObjectiveSubject;
  current: ObjectiveLevelDescription;
  problems: readonly ObservedProblem[];
  gapSummary: string;
}

interface ObjectivePrerequisite {
  // 运行时直接持有 Loader 解析出的同 language Guide。
  readonly guide: ObjectiveGuide;
  mapSubject(subject: ObjectiveSubject): ObjectiveSubject;
}
```

所有 ID 必须非空且在所属作用域内稳定。观测中的问题按建议处理顺序排列；
证据不足时返回可支持的层级，并把知识缺口显式建模为问题。

## ObjectiveGuide

```ts
interface ObjectiveGuide {
  // canonical Manifest URI 是 Objective 的唯一稳定身份。
  readonly manifestUri: ObjectiveManifestUri;
  readonly language: LanguageTag;
  readonly title: string;
  readonly description: string;
  readonly domainSchema: ObjectiveDomainSchema;
  readonly prerequisite: ObjectivePrerequisite | null;

  // 返回 prerequisite 前缀、本地显式层和唯一 terminal 的本地化描述。
  describeLevels(): readonly ObjectiveLevelDescription[];

  // 允许 IO 和观测扰动；不执行现实修改。
  probe(subject: ObjectiveSubject): Promise<ObjectiveObservation>;

  // 只读取当前 Guide 自己的 locale References。
  readPage(pageId: ReferencePageId): Promise<ReferencePage>;

  // prerequisite pages 通过 observation.current.guide 查询。
  searchPages(
    query: string,
  ): Promise<readonly ReferencePageSummary[]>;
}
```

`probe` 先验证 `subject` 满足 `domainSchema`；page 查询只依赖 loaded Guide
和 language。定义域、配置、探测或执行错误必须 reject，不能伪装成低 level
或成功结果。
时钟、文件系统、远端客户端和鉴权等执行依赖在装载时显式注入；窗口、预算与
优先级属于 OPS policy。公共 Objective API 不保留通用
`Record<string, unknown>` runtime context。

## Manifest 与装载

典型传输单元：

```text
my-objective-guide/
├── objective-guide.yaml       # 语言无关的结构语义
├── index.ts                   # checks 与装载 bindings
├── checks/
├── locales/
│   ├── zh-CN.yaml             # 完整 locale content
│   └── en-US.yaml
└── references/
    ├── zh-CN/                 # 完整 locale References
    └── en-US/
```

Reference page 使用稳定 ID 和内部链接；文件名与目录不是节点身份：

```markdown
---
id: repository-not-ready
tags:
  - repository
  - diagnosis
unknownProblemFallback: false
---

# Repository is not ready

先确认当前 checkout 是否对应 configured primary。

继续阅读 [[setup-runtime]] 与 [[primary-repository]]。
```

### 类型

```ts
interface ObjectiveLevelAdvancementManifest {
  checks: readonly CheckId[];
}

interface ObjectivePrerequisiteManifest {
  // 相对 URI 以当前 Manifest URI 为 base 解析。
  manifestUri: ObjectiveManifestUri;
  // 输入仅为当前 subject；输出是 prerequisite subject。
  subject: JsonataExpression;
}

interface ObjectiveLevelManifest {
  id: ObjectiveLevelId;
  // 所有显式 level 都有 advancement；terminal 不在此数组中。
  advancement: ObjectiveLevelAdvancementManifest;
}

type ObjectiveLevelsManifest = readonly [
  ObjectiveLevelManifest,
  ...ObjectiveLevelManifest[],
];

interface ObjectiveLevelContentManifest {
  title: string;
  description: string;
  // 一段 prompt 同时描述停留代价和进阶收益。
  outcome: string;
}

interface ObjectiveTerminalContentManifest {
  // 只本地化隐式 terminal，不定义 checks 或 advancement。
  title: string;
  description: string;
}

interface ObjectiveGuideContentManifest {
  title: string;
  description: string; // OG 最终追求的价值
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
  domainSchema: ObjectiveDomainSchema;

  // 第一版只允许一个 immediate prerequisite；递归形成全序链。
  prerequisite?: ObjectivePrerequisiteManifest;

  // 数组位置决定本地 level；id 只用于稳定关联 locale content。
  levels: ObjectiveLevelsManifest;

  defaultLanguage: LanguageTag;
  localizations: Readonly<
    Record<LanguageTag, ObjectiveLocalizationManifest>
  >;
}

type CheckResult =
  | { pass: true }
  | {
      pass: false;
      problems: readonly [ObservedProblem, ...ObservedProblem[]];
    };

type ObjectiveCheck = (
  subject: ObjectiveSubject,
  language: LanguageTag,
) => Promise<CheckResult>;

interface ObjectiveGuideLoadBindings {
  checks: Readonly<Record<CheckId, ObjectiveCheck>>;
  // prerequisite 已装载成同 language 的运行时 Guide。
  prerequisite?: ObjectiveGuide;
}

interface ObjectiveLoadOptions {
  // 省略时使用 defaultLanguage；显式不支持的 language 直接失败。
  language?: LanguageTag;
}

// Loader 内部工厂；manifestUri 已由 Loader canonicalize。
declare function createObjectiveGuide(
  manifestUri: ObjectiveManifestUri,
  manifest: ObjectiveGuideManifest,
  bindings: ObjectiveGuideLoadBindings,
  options?: ObjectiveLoadOptions,
): ObjectiveGuide;

interface ObjectiveLoader {
  // 相同 canonical URI + resolved language 始终返回同一 Guide 对象。
  load(
    manifestUri: ObjectiveManifestUri,
    options?: ObjectiveLoadOptions,
  ): Promise<ObjectiveGuide>;
}
```

### YAML 示例

Project 级 Objective：

```yaml
# Manifest URI:
# file:///workspace/objectives/repository-readiness/objective-guide.yaml
schemaVersion: 1
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

# 这里只保存结构；title、description、outcome 在 locale content 中。
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

对应的 `locales/zh-CN.yaml`：

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

Idea 级 Objective 把 Project levels 作为语义前缀：

```yaml
# Manifest URI:
# file:///workspace/objectives/idea-progress/objective-guide.yaml
schemaVersion: 1
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
  manifestUri: ../repository-readiness/objective-guide.yaml
  # JSONata 直接把 Idea subject 投影为 Project subject。
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

### 装载不变量

- Manifest 内不重复声明身份字段。Loader 以当前 Manifest URI 为 base 解析
  相对引用并 canonicalize；canonical URI 是 Objective 的稳定身份。
  相同 URI 与 resolved language 命中同一 Guide 对象。不同 language 可以有
  不同对象实例，但共享同一个 Objective 身份。
- 一个 application runtime 使用共享 ObjectiveLoader；其 cache 是所有已装载
  Guides 的 identity map。“全局”只指该 runtime，不承诺跨进程对象单例。
- `domainSchema` 固定为 Draft 2020-12 root object schema，只解析本地
  `#/$defs/...`；不远程取 schema、不 coercion，也不用 `default` 改写 subject。
- `levels` 非空，ID 局部唯一且不能为保留 ID `terminal`。每项都必须有
  advancement；`checks: []` 可以自然通过，但不接受 `advancement: null`。
- 默认工厂按顺序执行 checks，首个失败处形成观测；全部显式 advancement
  通过后合成唯一 terminal。`describeLevels()` 把 locale outcome 写入每个
  非 terminal description 的 `advancement`；terminal 的 advancement 为
  `null`。递归 prerequisite chain 的 terminal level 为：

  ```text
  所有 prerequisite 显式 level 数量 + 当前 Guide 的 levels.length
  ```

- Prerequisite 未 terminal 时，本地 checks 不运行；其 terminal 不单独插入，
  而与下一 Guide 的本地 level 0 边界合并。组合 Guide 复用 prerequisite 的
  非 terminal level descriptions 作为前缀，因此可以直接返回 prerequisite
  observation；`current.guide` 与 `subject` 已指向实际来源，无需 ID 路由。
- `prerequisite.subject` 使用固定的受限 JSONata profile：只能读取当前 subject，
  不能读取环境变量、文件或网络，不允许扩展函数、动态求值、用户递归、
  时间或随机能力，并限制表达式长度、AST 深度、执行时间和输出大小。输出必须是
  普通 JSON object，且通过 prerequisite `domainSchema`。
- Loader 递归调用 `load` 解析 prerequisite，并把缓存中的 Guide 直接写入
  `ObjectiveGuide.prerequisite.guide`；它按 canonical URI 拒绝无法解析、
  自引用或循环 prerequisite，也拒绝缺失、多余或 URI 不匹配的 prerequisite
  binding。整条 chain 使用同一 resolved language；第一版不支持会引入任意
  排序的多个 prerequisites。
- Language key 必须是 canonical BCP 47。省略选择时才使用
  `defaultLanguage`；不做父语言或字段级 fallback，也不混合不同 language。
  每个 locale 必须完整覆盖 terminal、全部 level IDs 和 References。
- 各 locale 的 References 保持相同 page IDs、unknown fallback 角色和链接目标；
  标题、正文与 tags 可以本地化。Loader 拒绝重复 ID、多个 unknown fallback、
  悬空链接和空页面；允许链接环和多个问题共享页面，不从目录或 tags 推断封闭
  语义。
- Check 直接返回入口 `pageId`；Loader 验证该 page 存在。无法确定已知处置页时，
  check 显式返回唯一 unknown fallback 的 ID。Agent 调用
  `observation.current.guide.readPage(problem.pageId)`。

资源路径相对 Manifest URI 解析。默认 Loader 只装载上述 Markdown page 协议；
高级 resolver 可以从 folder、package、数据库或网络取得同一传输结构，再由
自定义 factory 产出手写 OG，但仍以 canonical Manifest URI 参与缓存与身份判断。

## ObjectiveRegulator

```ts
interface RegulationLimits {
  maxIterations: number;
  timeoutMs: number;
  maxStalledIterations: number;
}

interface ObjectiveActionRequest {
  targetLevel: ObjectiveLevel;
  observation: ObjectiveObservation;
  problem: ObservedProblem;
}

type ObjectiveActionResult =
  // completed 只表示动作结束；是否进展由下一次 probe 判断。
  | { status: "completed"; summary: string }
  | { status: "blocked"; reason: string };

type ObjectiveActionExecutor = (
  request: ObjectiveActionRequest,
) => Promise<ObjectiveActionResult>;

interface RegulationRequest {
  targetLevel: ObjectiveLevel;
  subject: ObjectiveSubject;
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
  iterations: number; // 已请求的 Agent 动作次数
  latestObservation: ObjectiveObservation;
}

interface ObjectiveRegulator {
  readonly guide: ObjectiveGuide;

  // 仅探测；不会调用 Agent。
  probe(subject: ObjectiveSubject): Promise<ObjectiveObservation>;

  /**
   * 框架持有循环：
   * 1. probe；
   * 2. observation.current.level >= targetLevel 时结束；
   * 3. 取首个问题；Agent 通过 current.guide 查询 page；
   * 4. Agent 只执行一次现实动作；
   * 5. 重新 probe；
   * 6. 应用超时、迭代和连续无进展保护。
   */
  regulate(
    request: RegulationRequest,
    executeAction: ObjectiveActionExecutor,
  ): Promise<RegulationResult>;
}
```

OR 只到达本轮 `targetLevel`，不强制追求最高层。Page 查询属于一次行动
的认知过程，不额外增加 OR iteration；未建模异常必须 reject，不包装成
`RegulationStatus` 的成功形状。

## Objective Portfolio Supervisor

```ts
interface ObjectiveSafetyThresholds {
  defensiveThreshold: ObjectiveLevel;
  defensiveTarget: ObjectiveLevel;
}

interface ObjectiveRegistration {
  id: ObjectiveRegistrationId;
  regulator: ObjectiveRegulator;
  // 创建 registration 时先通过 guide.domainSchema 验证。
  subject: ObjectiveSubject;
  safety: ObjectiveSafetyThresholds;
}

interface ObjectivePortfolioEntry {
  registrationId: ObjectiveRegistrationId;
  // registration 的根 Guide；当前 prerequisite Guide 在 observation.current。
  guide: ObjectiveGuide;
  subject: ObjectiveSubject;
  observation: ObjectiveObservation;
  safety: ObjectiveSafetyThresholds;
}

interface ObjectivePortfolioObservation {
  // 多个现实样本的组合，不宣称是同一时刻的原子快照。
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
  // 数组顺序表达调度优先级。
  directives: readonly RegulationDirective[];
  deferred: readonly DeferredObjective[];
}

type ObjectivePortfolioPolicy = (
  observation: ObjectivePortfolioObservation,
) => Promise<ObjectivePortfolioPlan>;

interface ObjectivePortfolioRunResult {
  results: readonly {
    registrationId: ObjectiveRegistrationId;
    result: RegulationResult;
  }[];
}

interface ObjectivePortfolioSupervisor {
  // 使用 registration 的 subject 探测；损益读取 current.advancement.outcome。
  observe(): Promise<ObjectivePortfolioObservation>;

  // 先守防御阈值，再由已注入依赖的 policy 分配预算和窗口。
  plan(
    observation: ObjectivePortfolioObservation,
  ): Promise<ObjectivePortfolioPlan>;

  // 按计划下发给 OR；不修改 OG 的层级、checks 或 References。
  execute(
    plan: ObjectivePortfolioPlan,
    executeAction: ObjectiveActionExecutor,
  ): Promise<ObjectivePortfolioRunResult>;
}
```

同一 OG 可以绑定多个 subject，所以 OPS 以 `ObjectiveRegistrationId` 调度。
Project→Idea 等语义前置由 OG `prerequisite` 组合，不在 OPS 重复建模。
Portfolio policy 通过自身有类型的构造依赖读取预算、互斥、窗口和其他规划事实，
而不是接收通用 runtime bag；它不能比较或求和不同 Objective 的 level。执行可
串行或受控并发，但必须保留计划优先级、终止保护和独立结果。

## 与现有 ProfessionalModel 的关系

| 现有契约 | 新契约 |
| --- | --- |
| `ProfessionalModel.observe` | `ObjectiveGuide.probe` |
| `Problem.code` | `ObservedProblem.pageId` |
| `ProfessionalModel.guide` | `ObjectiveGuide.readPage` 的单页静态基线 |
| `ProfessionalModel.describe` | `ObjectiveGuide.describeLevels`，并增加静态 advancement outcome |

`whats-next` 已验证单目标观察和指导，但不是 OR 或 OPS 的生产实现。本轮只稳定
类型和装载边界；后续实现必须保持现有导航、语言、控制权和精确 revision 语义。
