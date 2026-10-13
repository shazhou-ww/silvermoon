# Objective Guide 类型体系

## 模型边界

| 构件 | 职责 |
| --- | --- |
| ObjectiveLoader | 以 Manifest URI 解析、缓存并递归组合语言中立 ObjectiveGuide |
| ObjectiveGuide（OG） | 定义单一 Objective 的定义域、判据、知识和本地化资源 |
| ObjectiveGuideInstance | 把一个 OG 绑定到确定的 subject 与 language，提供观测和知识查询 |
| Agent | 根据现状和 References 决定或执行一次现实动作 |

- `ObjectiveLevelId` 是单个 Objective 内可读、稳定的层级身份；先后关系只由
  Guide 返回的有序 descriptions 表达，不能跨 Objective 比较；系统可以长期
  停留在中间层。
- `probe` 是允许 IO、成本、扰动和时序撕裂的现实采样，不是原子快照。
- OG 只提供感知、参考知识和损益评估，现实修改全部由 Agent 完成。
- Folder、package、Manifest 和 reference pages 只是传输形式；Loader 是装载与
  identity-map 边界，运行时消费者只协作 `ObjectiveGuideInstance`。
- 势场术语只用于[理论溯源](./value-field-reasoning.md)，不进入公共 API。

## 公共基础类型

```ts
type ObjectiveManifestUri = string;
type CheckId = string;
type ReferencePageId = string;
type JsonataExpression = string;
type LanguageTag = string; // canonical BCP 47

type ObjectiveLevelId = string; // owning Guide 内可读、稳定

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
}

interface ReferencePage extends ReferencePageSummary {
  content: string;
}

interface ObjectiveLevelDescription {
  // prerequisite level 直接引用实际负责观测与 page 查询的 instance。
  instance: ObjectiveGuideInstance;
  id: ObjectiveLevelId;
  title: string;
  description: string;
  // 单段 prompt 同时描述停留代价和进阶收益；terminal 为 null。
  advancementOutcome: string | null;
}

interface ObjectiveObservation {
  current: ObjectiveLevelDescription;
  problems: readonly ObservedProblem[];
  gapSummary: string;
}

interface ObjectivePrerequisite {
  // 语言中立 Guide 直接持有 Loader 解析出的 prerequisite Guide。
  readonly guide: ObjectiveGuide;
  // createInstance 会验证受限 JSONata 的原始结果。
  mapSubject(subject: ObjectiveSubject): unknown;
}
```

所有 ID 必须非空且在所属作用域内稳定。观测中的问题按建议处理顺序排列；
证据不足时返回可支持的层级，并把知识缺口显式建模为问题。

## ObjectiveGuide 与 ObjectiveGuideInstance

```ts
interface ObjectiveGuideInstanceOptions {
  subject: ObjectiveSubject;
  // 省略时使用 Guide 的 defaultLanguage；显式不支持则失败。
  language?: LanguageTag;
}

interface ObjectiveSubjectValidationIssue {
  instancePath: string; // JSON Pointer；空字符串表示 root
  keyword: string;
  message: string;
}

type ObjectiveValidationIssues = readonly [
  ObjectiveSubjectValidationIssue,
  ...ObjectiveSubjectValidationIssue[],
];

type ObjectivePrerequisiteSubjectFailure =
  | {
      type: "projection-failed";
      message: string;
    }
  | {
      type: "validation-failed";
      projectedSubject: unknown;
      issues: ObjectiveValidationIssues;
    };

type ObjectiveGuideInstanceCreationError =
  | {
      type: "invalid-subject";
      guide: ObjectiveGuide;
      subject: ObjectiveSubject;
      issues: ObjectiveValidationIssues;
    }
  | {
      type: "invalid-prerequisite-subject";
      // 从根 Guide 到失败 prerequisite Guide。
      chain: readonly [
        ObjectiveGuide,
        ObjectiveGuide,
        ...ObjectiveGuide[],
      ];
      guide: ObjectiveGuide;
      failure: ObjectivePrerequisiteSubjectFailure;
    }
  | {
      type: "unsupported-language";
      // 可以在根 Guide 或任一 prerequisite Guide 失败。
      chain: readonly [ObjectiveGuide, ...ObjectiveGuide[]];
      guide: ObjectiveGuide;
      language: LanguageTag;
      supportedLanguages: readonly LanguageTag[];
    };

type ObjectiveGuideInstanceCreationResult =
  | {
      ok: true;
      instance: ObjectiveGuideInstance;
    }
  | {
      ok: false;
      error: ObjectiveGuideInstanceCreationError;
    };

interface ObjectiveGuide {
  // canonical Manifest URI 是 Objective 的唯一稳定身份。
  readonly manifestUri: ObjectiveManifestUri;
  readonly domainSchema: ObjectiveDomainSchema;
  readonly prerequisite: ObjectivePrerequisite | null;

  createInstance(
    options: ObjectiveGuideInstanceOptions,
  ): ObjectiveGuideInstanceCreationResult;
}

interface ObjectiveGuideInstance {
  readonly guide: ObjectiveGuide;
  readonly language: LanguageTag;
  readonly subject: ObjectiveSubject;
  readonly title: string;
  readonly description: string;
  // 使用同一 language 和投影 subject 创建；没有 prerequisite 时为 null。
  readonly prerequisite: ObjectiveGuideInstance | null;

  // 返回 prerequisite 前缀、本地显式层和唯一 terminal 的本地化描述。
  describeLevels(): readonly ObjectiveLevelDescription[];

  // 允许 IO 和观测扰动；不执行现实修改。
  probe(): Promise<ObjectiveObservation>;

  // 只读取当前 instance language 对应的 References。
  readPage(pageId: ReferencePageId): Promise<ReferencePage>;

  // prerequisite pages 通过 observation.current.instance 查询。
  searchPages(
    query: string,
  ): Promise<readonly ReferencePageSummary[]>;
}
```

Guide 是语言中立且可复用的 Objective 定义；Loader 只按 canonical Manifest URI
缓存 Guide。`createInstance` 依次验证根 subject、由近到远的 prerequisite
projection subject 和整条 chain 的 resolved language，返回第一个失败；这三类
预期失败只通过 `ObjectiveGuideInstanceCreationResult` 表达，不 throw 或依赖
Promise rejection。成功后 instance 绑定的 subject 与 language 不可变；Loader
不按任意 JSON subject 缓存 instance。Manifest/装载配置错误属于 `load`，
probe 或执行依赖故障属于对应异步操作，均不能伪装成低 level 或成功结果。
时钟、文件系统、远端客户端和鉴权等执行依赖在装载时显式注入；窗口、预算与
优先级属于 Guide 核心之外的规划 policy。公共 Objective API 不保留通用
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

Reference page 使用稳定 ID；内部链接直接属于正文，不作为独立 API 字段。
文件名与目录不是节点身份：

```markdown
---
id: repository-not-ready
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

interface ObjectiveReferencesManifest {
  source: string;
  // 默认读取 source 根目录的 404.md（id: "404"）；仅覆盖时配置。
  notFoundPageId?: ReferencePageId;
}

interface ObjectiveLocalizationManifest {
  content: string;
  references: ObjectiveReferencesManifest;
}

interface ObjectiveGuideManifest {
  schemaVersion: 1;
  domainSchema: ObjectiveDomainSchema;

  // 第一版只允许一个 immediate prerequisite；递归形成全序链。
  prerequisite?: ObjectivePrerequisiteManifest;

  // 数组顺序定义进阶次序；id 是公开、可读的稳定身份。
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
  // prerequisite 已装载成语言中立 Guide。
  prerequisite?: ObjectiveGuide;
}

// Loader 内部工厂；manifestUri 已由 Loader canonicalize。
declare function createObjectiveGuide(
  manifestUri: ObjectiveManifestUri,
  manifest: ObjectiveGuideManifest,
  bindings: ObjectiveGuideLoadBindings,
): ObjectiveGuide;

interface ObjectiveLoader {
  // 相同 canonical URI 始终返回同一语言中立 Guide 对象。
  load(manifestUri: ObjectiveManifestUri): Promise<ObjectiveGuide>;
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
    references:
      source: references/zh-CN
  en-US:
    content: locales/en-US.yaml
    references:
      source: references/en-US
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
    references:
      source: references/zh-CN
  en-US:
    content: locales/en-US.yaml
    references:
      source: references/en-US
```

### 装载不变量

- Manifest 内不重复声明身份字段。Loader 以当前 Manifest URI 为 base 解析
  相对引用并 canonicalize；canonical URI 是 Objective 的稳定身份。
  相同 canonical URI 命中同一语言中立 Guide 对象；language 与 subject 只属于
  `ObjectiveGuideInstance`。
- 一个 application runtime 使用共享 ObjectiveLoader；其 cache 是所有已装载
  Guides 的 identity map。“全局”只指该 runtime，不承诺跨进程对象单例。
- `domainSchema` 固定为 Draft 2020-12 root object schema，只解析本地
  `#/$defs/...`；不远程取 schema、不 coercion，也不用 `default` 改写 subject。
- `levels` 非空，ID 局部唯一且不能为保留 ID `terminal`。每项都必须有
  advancement；`checks: []` 可以自然通过，但不接受 `advancement: null`。
- 默认工厂按顺序执行 checks，首个失败处形成观测；全部显式 advancement
  通过后合成唯一 terminal。`describeLevels()` 把 locale outcome 写入每个
  非 terminal description 的 `advancementOutcome`；terminal 的
  `advancementOutcome` 为 `null`。返回顺序依次为 prerequisite 非 terminal
  descriptions、当前 Guide 的显式 descriptions 和唯一 terminal；公共契约不
  暴露 numeric level 或 index。
- Prerequisite 未 terminal 时，本地 checks 不运行；其 terminal 不单独插入，
  而与下一 Guide 的首个本地 level 边界合并。组合 Guide 复用 prerequisite 的
  非 terminal level descriptions 作为前缀，因此可以直接返回 prerequisite
  observation；`current.instance` 已同时携带实际 Guide、投影 subject 与
  resolved language，无需 ID 路由。
- `prerequisite.subject` 使用固定的受限 JSONata profile：只能读取当前 subject，
  不能读取环境变量、文件或网络，不允许扩展函数、动态求值、用户递归、
  时间或随机能力，并限制表达式长度、AST 深度、执行时间和输出大小。求值失败，
  或输出不是通过 prerequisite `domainSchema` 的普通 JSON object 时，
  `createInstance` 返回 `invalid-prerequisite-subject`，并携带从根 Guide 到失败
  Guide 的对象 chain。
- Loader 递归调用 `load` 解析 prerequisite，并把缓存中的 Guide 直接写入
  `ObjectiveGuide.prerequisite.guide`；它按 canonical URI 拒绝无法解析、
  自引用或循环 prerequisite，也拒绝缺失、多余或 URI 不匹配的 prerequisite
  binding。`createInstance` 用根 instance 的 resolved language 和 JSONata
  投影 subject 递归创建 prerequisite instance；第一版不支持会引入任意排序的
  多个 prerequisites。
- Language key 必须是 canonical BCP 47。创建 instance 时省略 language 才使用
  `defaultLanguage`；不做父语言或字段级 fallback。根 Guide 或任一 prerequisite
  Guide 不支持 resolved language 时，返回带失败 Guide、对象 chain 和支持列表的
  `unsupported-language`。每个 locale 必须完整覆盖 terminal、全部 level IDs
  和 References。
- 各 locale 的 References 保持相同 page IDs 和解析后的 `notFoundPageId`；标题与正文
  可以本地化。Markdown 内部链接属于正文，`ReferencePage` 不另行返回 links，
  `searchPages` 也不暴露 tags。Loader 拒绝重复 ID、缺失的 not-found page、
  悬空内部链接和空页面；允许链接环和多个问题共享页面，不从目录或搜索索引
  元数据推断封闭语义。
- Check 直接返回入口 `pageId`。`readPage` 找不到请求 ID 时返回当前 instance
  locale 的普通 not-found 页面。省略 `notFoundPageId` 时，默认使用 References
  source 根目录的 `404.md`，其 frontmatter 必须声明 `id: "404"`；显式配置则
  按 page ID 解析，不限定文件名。默认文件缺失、ID 不匹配或覆盖目标不存在均是
  装载错误。返回页面的 `id` 因而不同于请求 ID，
  不需要 `unknownProblemFallback` 角色或布尔字段。Agent 调用
  `observation.current.instance.readPage(problem.pageId)`。
  只有 page ID 不存在才走 not-found；权限、IO 或解析错误仍明确报错，不返回
  404 页面。搜索无匹配返回空列表，不返回 not-found page。

资源路径相对 Manifest URI 解析。默认 Loader 只装载上述 Markdown page 协议；
高级 resolver 可以从 folder、package、数据库或网络取得同一传输结构，再由
自定义 builder 产出手写 OG，但仍以 canonical Manifest URI 参与缓存与身份判断。

## 可选扩展

Silvermoon 当前只需要 Loader、Guide 和 Guide instance 完成一次定向观测与知识
查询，不需要自动复归或多目标调度。后续能力分别定义在
[ObjectiveRegulator](./objective-regulator.md) 和
[Objective Portfolio Supervisor](./objective-portfolio-supervisor.md) 中；
它们依赖本页核心契约，但不属于当前 Silvermoon 实现范围。

## 与现有 ProfessionalModel 的关系

| 现有契约 | 新契约 |
| --- | --- |
| `ProfessionalModel.observe` | `ObjectiveGuideInstance.probe` |
| `Problem.code` | `ObservedProblem.pageId` |
| `ProfessionalModel.guide` | `ObjectiveGuideInstance.readPage` 的单页静态基线 |
| `ProfessionalModel.describe` | `ObjectiveGuideInstance.describeLevels`，并增加静态 `advancementOutcome` |

`whats-next` 已验证单目标观察和指导；Silvermoon 当前只需演进这份 Guide 核心
契约。后续实现必须保持现有导航、语言、控制权和精确 revision 语义，不因扩展
文档存在而引入 OR 或 OPS 运行依赖。
