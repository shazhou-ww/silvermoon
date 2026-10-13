# Objective Guide 类型体系

## 模型边界

| 构件 | 职责 |
| --- | --- |
| ObjectiveLoader | 以 Manifest URI 解析、缓存并递归组合语言中立 ObjectiveGuide |
| ObjectiveGuide（OG） | 定义单一 Objective 的定义域、层级、checks、problems 与知识 |
| ObjectiveGuideInstance | 把 OG 绑定到确定的 subject 与 language，提供观测和知识查询 |
| Agent | 根据 observation 与 References 决定或执行一次现实动作 |

- Level 是单个 Objective 内有序、可读且稳定的状态；系统可以长期停留在中间层。
- `probe` 是允许 IO、成本、扰动和时序撕裂的现实采样，不是原子快照。
- OG 只提供感知与参考知识，不修改现实；现实动作全部由 Agent 完成。
- Manifest、checks 与 References 是自洽的传输单元；Manifest 只引用 Check ID，
  executable 和 Problem Reference 均按 ID 约定发现，不依赖宿主 JavaScript
  module binding 或重复注册表。
- 势场术语只用于[理论溯源](./value-field-reasoning.md)，不进入公共 API。

## 公共契约

```ts
type ObjectiveManifestUri = string;
type ObjectiveLevelId = string;
type CheckId = string;
type ProblemId = string;
type ReferencePageId = string;
type LanguageTag = string; // canonical BCP 47
type JsonataExpression = string;

type JsonValue =
  | string
  | number
  | boolean
  | null
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

type JsonObject = Readonly<Record<string, JsonValue>>;
type ObjectiveSubject = JsonObject;
type ObjectiveDomainSchema = JsonObject;

interface ObservedProblem {
  id: ProblemId;
  parameters: JsonObject;
}

interface ReferencePageSummary {
  id: ReferencePageId;
  title: string;
}

interface ReferencePage extends ReferencePageSummary {
  description?: string;
  content: string;
}

interface ObjectiveLevelDescription {
  instance: ObjectiveGuideInstance;
  id: ObjectiveLevelId;
  title: string;
  description: string;
  advancementOutcome: string | null;
}

interface ObjectiveObservation {
  current: ObjectiveLevelDescription;
  problems: readonly ObservedProblem[];
  gapSummary: string;
}
```

Problem 的稳定机器身份与本地化文案分离。Check 只返回 `ProblemId` 和结构化
parameters；instance 从 `problems/<id>` 读取当前 language 的说明。动态值通过
受限插值呈现，不执行模板表达式、include、脚本或 Reference 链接。

```ts
interface ObjectiveGuideInstanceOptions {
  subject: ObjectiveSubject;
  language?: LanguageTag;
}

interface ObjectivePrerequisite {
  readonly guide: ObjectiveGuide;
  readonly minimumLevelId: ObjectiveLevelId | "terminal";
  mapSubject(subject: ObjectiveSubject): unknown;
}

interface ObjectiveGuide {
  readonly manifestUri: ObjectiveManifestUri;
  readonly domainSchema: ObjectiveDomainSchema;
  readonly prerequisite: ObjectivePrerequisite | null;

  createInstance(
    options: ObjectiveGuideInstanceOptions,
  ): ObjectiveGuideInstanceCreationResult;
}

interface ObjectiveGuideInstance {
  readonly guide: ObjectiveGuide;
  readonly subject: ObjectiveSubject;
  readonly language: LanguageTag;
  readonly title: string;
  readonly description: string;
  readonly prerequisite: ObjectiveGuideInstance | null;

  describeLevels(): readonly ObjectiveLevelDescription[];
  probe(): Promise<ObjectiveObservation>;
  readPage(pageId: ReferencePageId): Promise<ReferencePage>;
  searchPages(query: string): Promise<readonly ReferencePageSummary[]>;
}
```

Subject validation、unsupported language 与 prerequisite projection failure
继续使用有类型的 `ObjectiveGuideInstanceCreationResult`，而不是 throw。
Manifest、References 或 executable 配置错误属于 Loader configuration error；
check 启动、超时、协议和输出错误属于 probe operation error，均不能伪装成低
level、普通 problem 或成功。

## Prerequisite 最低层

Manifest 可以声明 immediate prerequisite 必须达到的最低层：

```yaml
prerequisite:
  manifestUri: ../project/objective-guide.yaml
  subject: |
    {
      "root": root,
      "userHome": userHome
    }
  minimumLevelId: repository-unready
```

`minimumLevelId` 只能是 immediate prerequisite 自己声明的本地 level ID 或
保留值 `terminal`。省略时默认 `terminal`，保持“前置目标全部完成后才解锁”的
既有语义。

“达到某层”表示 prerequisite 已通过该层之前的全部 advancement，当前采样位置
是该层、其后续本地层或 terminal；不要求通过该层自己的 advancement。未达到
minimum 时，当前 Guide 的 checks 不运行，并直接返回 prerequisite observation。
达到 minimum 后，当前 Guide 可以运行，即使 prerequisite 尚未 terminal。

组合后的 `describeLevels()` 只把 prerequisite 中严格早于 minimum 的本地层作为
阻塞前缀，再附加当前 Guide 的本地层和唯一 terminal。这样不会在当前 Guide
已经解锁后仍把未要求通过的 prerequisite 后续层伪装成当前目标的必经顺序。
若需要约束更深 prerequisite chain，应由 immediate prerequisite 自己声明其
minimum，不使用可能重名的跨 Guide level ID。

## 传输布局

```text
my-objective-guide/
├── objective-guide.yaml
├── checks/
│   ├── project-valid/         # CheckId 直接映射到同名目录
│   │   ├── run.py             # 唯一 entry；shebang 声明 interpreter
│   │   └── schema.json        # 可选的 check 私有资源
│   └── repository-ready/
│       └── run.exe            # native entry 也遵循 run.* pattern
└── references/
    ├── system/
    │   ├── overview/
    │   │   ├── en-US.md
    │   │   └── zh-CN.md
    │   └── 404/
    │       ├── en-US.md
    │       └── zh-CN.md
    ├── levels/
    │   ├── unavailable/
    │   │   ├── en-US.md
    │   │   └── zh-CN.md
    │   └── terminal/
    │       ├── en-US.md
    │       └── zh-CN.md
    ├── checks/
    │   └── project-valid/
    │       ├── en-US.md
    │       └── zh-CN.md
    ├── problems/
    │   └── project-invalid/
    │       ├── en-US.md
    │       └── zh-CN.md
    └── pages/
        └── repository-synchronization/
            ├── en-US.md
            └── zh-CN.md
```

Reference ID 始终是 `<namespace>/<id>`，目录路径是身份，language 文件是同一
节点的 locale 投影：

- `levels/<level-id>` 对应 Manifest level；
- `checks/<check-id>` 对应 advancement 引用的 Check ID；
- `problems/<problem-id>` 对应 check 实际返回的 Problem ID；
- `pages/<page-id>` 是普通 wiki 页面；
- runtime-owned `system/overview` 提供整个 Objective 的 title、description 和
  overview 正文，`system/404` 是固定 not-found；
- 合成 terminal 不进入 Manifest levels，但固定使用 `levels/terminal`。

每个节点严格位于 `<namespace>/<id>/<language>.md`，不允许继续嵌套。
Frontmatter 不重复路径已经编码的 ID、类型或语言。不同 namespace 使用严格的
properties profile：`system/overview` 提供 `title` 与 `description`；普通
level 提供 `title`、`description` 和 `outcome`；`levels/terminal` 提供
`title` 与 `description`；check 提供 `title` 与 `description`；problem 提供
`title`、`description` 和可选 `instruction`；普通 page 至少提供 `title`。

```markdown
---
title: Primary history diverged
description: Local and primary history contain independent commits.
instruction: Preserve both histories and integrate them without rewriting.
---

更多背景见 [[pages/repository-synchronization]]。
```

内部链接使用完整 Reference ID，并由 instance language 选择叶子文件。Loader
拒绝悬空链接，允许链接环。Manifest 不配置或覆盖 not-found identity；只有请求
的 Reference ID 不存在时才返回当前语言的 `system/404`。Instance 的
`title`、`description` 与整体 overview 来自固定的 `system/overview`；
`readPage("system/overview")` 返回完整页面。权限、IO、编码、frontmatter 和
协议错误必须明确失败；搜索无匹配返回空数组，不返回 404。

## Manifest

```ts
interface ObjectivePrerequisiteManifest {
  manifestUri: ObjectiveManifestUri;
  subject: JsonataExpression;
  minimumLevelId?: ObjectiveLevelId | "terminal";
}

interface ObjectiveLevelManifest {
  id: ObjectiveLevelId;
  advancement: {
    checks: readonly CheckId[];
  };
}

interface ObjectiveGuideManifest {
  schemaVersion: 1;
  domainSchema: ObjectiveDomainSchema;
  prerequisite?: ObjectivePrerequisiteManifest;
  levels: readonly [
    ObjectiveLevelManifest,
    ...ObjectiveLevelManifest[],
  ];
  defaultLanguage: LanguageTag;
  languages: readonly [LanguageTag, ...LanguageTag[]];
}
```

示例：

```yaml
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

levels:
  - id: unavailable
    advancement:
      checks:
        - project-valid
        - repository-ready

defaultLanguage: zh-CN
languages:
  - zh-CN
  - en-US
```

Level ID 在 Manifest 内唯一。References 固定从 Guide 根目录的 `references/`
装载，不由 Manifest 覆盖。每个 advancement `CheckId` 固定解析为 Guide 根目录
的 `checks/<check-id>/` 和 `references/checks/<check-id>`；check 返回的每个
`ProblemId` 固定解析为 `references/problems/<problem-id>`。Manifest 不重复
声明 executable path、check 注册表或允许的 problem 列表。Guide 与合成
terminal 的展示内容也不由 Manifest 指定，分别固定使用 `system/overview` 和
`levels/terminal`。

`domainSchema` 固定为 Draft 2020-12 root object schema，只允许本地
`#/$defs/...`，不远程取 schema、不 coercion，也不用 `default` 改写 subject。
Prerequisite subject 继续使用受限 JSONata profile，不读取环境、文件或网络，
不允许扩展函数、动态求值、递归、时间或随机能力，并限制表达式与输出资源。

## Check executable 协议

每个 check 是 `checks/<check-id>/` 中约定发现的单一入口，不是宿主函数：

```ts
interface CheckRequest {
  protocolVersion: 1;
  subject: ObjectiveSubject;
  probe: {
    // 本次完整 probe invocation 唯一的绝对临时目录。
    tempDirectory: string;
  };
}

type CheckResult =
  | { pass: true }
  | {
      pass: false;
      problems: readonly [{
        id: ProblemId;
        parameters: JsonObject;
      }, ...{
        id: ProblemId;
        parameters: JsonObject;
      }[]];
    };
```

Runtime 向 stdin 写入单个 JSON request，check 向 stdout 写入单个 JSON result。
`pass: false` 是正常业务结果并以退出码 0 返回；非零退出、启动失败、超时、
非法 JSON、额外 stdout、未知 problem 或协议不匹配都是 operation error。
Check 不接收 language，也不返回 title、description 或其他本地化文本。

每次根 instance `probe()` 创建一个新的空 `probe.tempDirectory`。同一次 probe 的
整个 prerequisite chain 与随后执行的本地 checks 都收到同一个绝对路径，因此
前序 check 可以把昂贵采样写成文件，后序 check 可以复用；并发 probe 必须使用
不同目录。目录不得在不同 probe、进程重启或 Agent 行动后复用，缓存内容也不是
持久状态或成功证据。Runtime 在 probe 完成、失败或取消后回收目录，并对创建、
权限、配额与清理失败给出明确 operation diagnostics。

公开 `probe()` 负责创建和销毁 context；内部 prerequisite probing 必须使用
同一个 `probeWithContext(context)`，不能递归调用会另建目录的公开 `probe()`。
单独调用 prerequisite instance 的公开 `probe()` 则自然创建自己的新 context。

核心不提供旧 ProfessionalModel 的注入式 `useState`。若语言 SDK 提供
`useMemo(key, producer)`，它必须把 key 映射到 `probe.tempDirectory` 内的受控
文件，以原子写入保存本 probe 的 JSON/blob 结果；cache miss 才运行 producer。该
helper 不触发重渲染、不允许任意跨 probe state，也不能把缓存路径或内容写到
Guide、Manifest、References 或 event history。

入口固定从 Manifest 所在 Guide 根目录的 `checks/<check-id>/` 解析，不接受
Manifest path override。该目录必须恰好包含一个名为 `run` 或匹配 `run.*` 的
普通文件；其他资源可以共存，但多个或缺失 entry 都是配置错误。扩展名只服务
编辑器与人类，不用于选择 interpreter，也不读取 `PATHEXT`、Windows 文件关联
或 registry。

Native executable 直接创建进程。文本 script 必须以受支持的 shebang 声明
interpreter；第一版只支持不带动态表达式的
`#!/usr/bin/env <interpreter>`。POSIX 要求 entry executable bit，并可由内核
处理 shebang；Windows 由 runtime 识别同一 shebang、从受控 PATH 解析
interpreter，再以 `<interpreter> <absolute-entry-path>` 参数数组直接启动，
不经过 shell。由此 `run.py`、`run.js`、`run.mjs`、`run.ps1` 或自定义扩展名
都使用同一协议；没有 shebang 的文本、复杂 `env -S`、重定向、管道与 command
string 不受支持。

Runtime 不拼接任何 subject、Problem ID 或其他动态参数，全部业务输入只走
stdin JSON；唯一额外能力是 request 中 runtime-owned 的
`probe.tempDirectory`。
所有平台都使用固定 cwd、受控环境、统一超时和 stdout/stderr 大小限制，并
拒绝 check directory、入口、资源或 probe cache 通过 symlink/reparse point
逃逸。远程 Manifest 不能被隐式下载后执行。

Probe 按 level 与 check 声明顺序执行，首个失败 check 形成 observation；一个
失败 check 返回的 problems 保持声明顺序。每次 probe 都重新启动适用 checks，
只允许在本 probe directory 内 memoize，不缓存跨 probe 现实结果，也不为了
抵消进程成本而并行化并改变诊断优先级。

## 装载不变量

- Canonical Manifest URI 是 Guide 的唯一稳定身份；Loader cache 不按 subject
  或 language 缓存 instance。
- Language 必须是 canonical BCP 47。省略 instance language 才使用 default；
  不做父语言或字段 fallback。
- 每个 Reference 节点必须拥有 `languages` 声明的完整文件集合，不允许 locale
  独有节点。Manifest 声明的全部 level 和引用的 check 必须有同名 Reference；
  problem 节点定义 check 可返回的稳定 Problem ID vocabulary。
- `system/overview`、`system/404` 和 `levels/terminal` 必须存在并覆盖全部
  languages；Manifest 不能改变其 identity。`system` 不允许其他节点。
- Prerequisite URI 循环、未知 minimum level、References 结构不完整、缺失
  check Reference、check directory、唯一 entry 或合法启动方式都在 load
  阶段失败。未知
  Problem ID 只能在 check 返回结果时发现，并作为 operation error 明确失败。
- Prerequisite 未达到 minimum 时不运行本地 checks；达到后不要求 prerequisite
  terminal。省略 minimum 时行为与原来的 terminal barrier 一致。
- 全部适用 checks 通过后合成唯一 terminal；公共契约不暴露 numeric level 或
  index。

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
| `Problem.code` | `ObservedProblem.id`，并解析 `problems/<id>` |
| `ProfessionalModel.guide` | `ObjectiveGuideInstance.readPage` 的静态知识基线 |
| `ProfessionalModel.describe` | `ObjectiveGuideInstance.describeLevels` 与 advancement outcome |

`whats-next` 已验证单目标观察和指导；Silvermoon 当前只需演进这份 Guide 核心
契约。后续实现必须保持现有导航、语言、控制权和精确 revision，不因扩展文档
存在而引入 OR 或 OPS 运行依赖。三个作用域的具体 levels、checks 与命令边界见
[领域契约](./silvermoon-objectives.md)。
