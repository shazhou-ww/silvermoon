# 函数式职责与关键函数设计

## 定位

本文件服务于 canonical 理想契约 [Idea.md](./Idea.md)，列出职责模块的关键函数、
候选签名与副作用边界，供理想世界评审使用。它不是第二份契约、实施计划、
执行证据或人工批准；不授权开始重构。

采用 functional core / imperative shell（函数式核心／副作用外壳）：
规则和变更规划使用纯函数，用例显式编排 I/O。不引入服务类、依赖注入容器、
通用命令总线或通用 effect 引擎。

下文使用 TypeScript 记法表达接口草案，不要求将现有 JavaScript 仓库迁移到
TypeScript，也不新增公共 API。类型名表示需要收敛的语义契约，不是已经实现的
声明。函数名、类型字段、目录、物理文件数量和迁移顺序尚未锁定。

## 依赖方向与通用约束

```text
CLI 适配 / 既有公共 API / Agent 调用方
                  ↓
              应用用例
           ↙      ↓      ↘
      纯规则   命令运行时   读写函数
                  ↓
              四投影报告
                  ↓
          JSON / Markdown / TUI
```

- 模块按变化原因划分，不按“是不是纯函数”机械分类。适配器所属的纯解析函数
  可以留在适配器中。
- 纯函数只接收明确事实，不读取全局配置、环境变量、时间、随机源或 trace。
- 每个用例只接收所需函数依赖，不接收万能 Context，也不调用另一命令的实现。
- 命令消息与 idea 持久事件使用不同类型、不同 reducer，不合并为一种事件流。
- 保留成熟算法、批量与增量路径，不为了函数式设计重写协议或降低保护。
- 保持既有公共导出和 Agent 独立子路径；公共入口只做受控导出与必要组装。

## 纯函数 coding convention

本 idea 采用正常业务函数名加 JSDoc `@pure` 的显式标注，并结合模块依赖检查。
不使用 `$` 前缀或 `Pure` 后缀，不为标注重命名既有公共 API。
这是设计约定，不是当前源码已经完成标注或检查器已经实现的声明。

### 标注形式与适用范围

在本次重构涉及的函数中，经确认满足纯度要求的函数，包括内部函数和适配器中的
纯解析函数，使用紧邻函数声明的 JSDoc `@pure`。已有 JSDoc 中直接增加该 tag，
无须另写重复说明。以下为候选签名的标注示例：

```ts
/** @pure */
function evaluateLocalReadiness(
  facts: LocalRepositoryFacts,
  requirement: "navigation" | "creation",
): ReadinessAssessment;

/** @pure */
function renderResponse(
  response: Response,
  context: { now: Date },
): string;
```

函数表达式或箭头函数的标记放在其绑定声明前；实施阶段明确 AST 识别形式，
不通过正则匹配任意位置的同名注释。未标注函数视为纯度未确认，不自动推断为
纯函数；副作用编排、I/O 函数和带 I/O reader 的适配器构造不标注 `@pure`。
不顺便开展与重构无关的全仓标注清理。

`@pure` 表达可验证的设计承诺，不是信任豁免，也不是供 bundler 删除调用的
`/* @__PURE__ */` 注释。不得把二者混用。

### 纯度契约

- 返回值或校验错误仅由显式输入决定，不读取或修改可变的外部状态。
- 不修改输入参数及其可达对象，不修改模块级共享状态；局部新建且未逃逸的
  数据可以使用局部赋值，不把“纯函数”等同于“禁止所有局部 mutation”。
- 不直接或间接访问文件系统、网络、子进程、终端、trace 或日志输出。
- 不隐式读取真实时间、随机源、环境变量或进程状态。时间和随机字节由外壳
  获取后显式传入；展示函数接收 now，不能内部读取当前时间。
- 调用的本地函数也应满足纯度契约并具有可检查标记。外部能力使用明确审核的
  纯调用白名单，不笼统信任整个包或某个模块的所有导出。
- 不执行纯度未知的回调；确有需要时明确纯回调接口和验证策略。注入函数或
  reader 不自动获得纯度，例如只读 Git 的函数仍然是 I/O。
- 可以返回显式错误或抛出确定的不变量错误，但不能为诊断写日志或吞掉异常。
- 引用不变的模块常量可以是纯读取，但不能仅凭 `const` 就认定其可达对象不可变。

### 检查与证明边界

实施阶段将标记识别与现有模块依赖检查结合，检查禁用 I/O 导入、外部状态访问、
未确认的调用，以及可识别的参数和共享状态修改。规则需覆盖被标注函数的调用
依赖，不能只禁止函数体内出现几个 API 名称。

纯规则与适配器保持单向依赖，但不强行将所有纯解析函数搬到领域目录。
检查规则应有正反例，确保标记不会绕过禁止项，同时允许显式时间输入、不可变
常量和局部新建数据等合法情况。

静态检查对动态调用、别名、深层对象修改和第三方实现存在局限，不宣称数学上
证明纯度。结合现有 sanity I/O 隔离、输入不可变测试和依赖边界测试验证；
保留既有错误、并发与增量路径断言，不以删除测试或禁用 guard 换取通过。
具体工具、白名单和实施步骤在理想契约批准后的实施阶段收敛，当前不安装工具
或改写源码。

## 基础语义类型

```ts
type Result<T, E> =
  | { ok: true; value: T }
  | { ok: false; error: E };

type SnapshotTarget =
  | { type: "head" }
  | { type: "commit"; revision: string }
  | { type: "staged" }
  | { type: "worktree" }
  | { type: "remote" };

type EventCursor = Readonly<{
  length: number;
  digest: GitObjectId;
}>;

type ObservedDevice = Readonly<{
  runtime: {
    source: "global" | "source-checkout" | "other";
    executable: string | null;
    version: string | null;
    globalInstallationPresent: boolean;
  };
  globalConfig: {
    path: string;
    present: boolean;
    valid: boolean;
  };
  diagnostics: readonly Diagnostic[];
}>;

type WorldRevisions = Readonly<{
  idealRevision: GitObjectId;
  implementationRevision: GitObjectId;
  deploymentRevision: GitObjectId;
}>;

type Report = Readonly<{
  intention: Intention;
  observation: PublicObservation;
  actions: readonly CompletedAction[];
  response: Response;
}>;
```

`EventCursor.length` 是已处理的规范事件字节长度，不是记录数；`digest` 是精确
前缀对应的 events/ folder Git digest，支持项目的 SHA-1/SHA-256 object format。
`CompletedAction` 保留现有 action 投影的内容，不重新发明公共报告 schema。

`Result` 仅表达内部可预期校验结果，不直接改变既有公共 API 的返回值或异常
行为。内部不变量失败仍显式抛错；I/O 错误映射为现有诊断或向上传播，不能成为
成功默认值。所有以下签名都必须通过兼容包装保持现有外部行为。

## 基础层目标模块

以下英文名是目标模块／目录名；每个名称对应一个变化原因。现有 A–L 标记仅用于
组织接口讨论，不是允许继续保留的宽泛物理模块。

```text
bin/<application-entry>.(js|mjs)
src/business/<business-entry>.js
src/business/shared/<shared-function>.js
src/foundation/<module>/{README.md,index.js,<implementation>.js}
```

`bin/` 中每个文件是完整应用入口，不再调用另一份同入口 adapter；业务入口与
shared 函数均一函数一文件，只通过显式 export-only index 发现；基础模块一目录，
README 必须逐项解释关键 export，而不只写模块名称或泛化描述。

| 模块 | 唯一职责 |
| --- | --- |
| `git` | Git 命令、refs／objects、显式 fetch 与提交关系 |
| `snapshot` | snapshot 坐标选择和不可变批量内容读取 |
| `installation` | 当前运行来源和全局 Silvermoon 安装事实 |
| `device-config` | 全局 Silvermoon 配置读取与严格解析 |
| `project-config` | 项目配置读取、严格解析及来源 |
| `guidance` | 固定 phase guidance 及 content revision |
| `skill-registration` | canonical／registered skill 来源与一致性 |
| `package-resource` | 随包 schema、模板和静态资源定位 |
| `schema` | 版本化结构字段与类型校验 |
| `idea-model` | idea 身份、状态、世界 revision 与生命周期规则 |
| `idea-query` | 显式 idea facts 的过滤、排序、限制和标题投影 |
| `idea-template` | 显式语言／版本对应的规范世界文档内容 |
| `scaffold-plan` | 显式 facts 到 `ScaffoldPlan` 的纯规划 |
| `event-codec` | 规范事件记录与 segment 字节解析、校验和序列化 |
| `event-reducer` | 已验证事件到状态或协议错误的归约 |
| `event-store` | 1000 条边界的分段读取与准确字节计划 |
| `event-history` | primary prefix、folder digest 和历史边界验证 |
| `event-cursor` | 准确前缀验证和 suffix 增量结果 |
| `projection-cache` | 可丢弃的认证派生投影缓存 |
| `owned-write` | 脚手架独占创建和本操作所有权清理 |
| `state-transaction` | 正常状态追加的锁内复查和准确字节原子应用 |
| `command-message` | 单次调用消息归约与 action 顺序不变量 |
| `report` | 显式终态到四投影、诊断和 next steps |
| `renderer` | 显式报告与时间到 JSON／Text／Markdown 的纯渲染 |
| `terminal` | stdout／stderr、TTY 能力和 clipboard 适配 |
| `tui` | 惰性交互界面和明确用户选择 |
| `language` | 内容语言、输出语言和 locale 基础值 |
| `coordinates` | repository URL、OID、ULID 和规范相对路径值 |
| `trace` | 结构化 trace 和显式计时事实发布 |
| `process` | 受控子进程执行及 stdout／stderr／exit facts |

上述模块不能以便利为由重新合并。`snapshot` 可以依赖 `git`，`event-history`
可以依赖 `git` 与 `event-codec`，`renderer` 可以依赖 `language`；反向依赖禁止。
跨模块组合属于业务层，不新增 `utils`、万能 repository 或共享 Context。shared
只接收至少两个业务入口实际复用的编排函数，不接收基础 helper 或候选复用代码。

## 职责模块与关键函数

### 纯度标注索引

以下标注是候选设计的要求，不是对当前源码实现的纯度声明：

- **纯函数**：只由显式参数决定返回值或校验错误，不读写外部状态，不改变输入，
  不访问 I/O、时钟、随机源或 trace。
- **副作用编排**：调用注入的读写、执行或发布函数，控制顺序；注入依赖并不使其
  成为纯函数。
- **I/O 函数**：直接提供读取、写入、子进程、网络或终端能力。
- **适配器构造**：构造带 I/O 能力的 reader，不视为纯规则；具体构造是否立即
  读取或预加载需要在实施接口中明确。

异步返回值本身不能决定纯度。纯函数可返回显式错误或抛出确定的不变量错误，
但不能为了诊断写日志。所有函数的分类如下：

| 模块 | 函数 | 分类 |
| --- | --- | --- |
| A | `normalizeCliOptions` | 纯函数 |
| A | `readEventInput` | I/O 函数 |
| A | `selectOutputRenderer` | 纯函数 |
| A | `exitCodeForReport` | 纯函数 |
| A | `executeCli` | 副作用编排 |
| B | `listIdeasUseCase` | 副作用编排 |
| B | `whatsNextUseCase` | 副作用编排 |
| B | `createIdeaUseCase` | 副作用编排 |
| B | `checkRepositoryUseCase` | 副作用编排 |
| B | `replayEventsUseCase` | 副作用编排 |
| B | `queryEventDeltaUseCase` | 副作用编排 |
| B | `appendEventUseCase` | 副作用编排 |
| C | `observeDevice` | 副作用编排 |
| C | `observeProject` | 副作用编排 |
| C | `observeIdea` | 副作用编排 |
| C | `assembleObservation` | 纯函数 |
| C | `selectIdea` | 纯函数 |
| D | `evaluateLocalReadiness` | 纯函数 |
| D | `evaluatePrimaryRelation` | 纯函数 |
| D | `evaluateHistoryReadiness` | 纯函数 |
| E | `deriveIdeaState` | 纯函数 |
| E | `normalizeIdeaQuery` | 纯函数 |
| E | `queryIdeaInventory` | 纯函数 |
| E | `extractIdeaTitle` | 纯函数 |
| F | `parseEventRequest` | 纯函数 |
| F | `reduceIdeaEvent` | 纯函数 |
| F | `replayIdeaEvents` | 纯函数 |
| F | `validateHumanDecision` | 纯函数 |
| F | `planEventAppend` | 纯函数 |
| F | `planEventRevision` | 纯函数 |
| G | `initialInternalObservation` | 纯函数 |
| G | `reduceObservation` | 纯函数 |
| G | `startCommand` | 纯函数 |
| G | `recordObservation` | 纯函数 |
| G | `requestAction` | 纯函数 |
| G | `finishAction` | 纯函数 |
| G | `completeCommand` | 纯函数 |
| G | `performAction` | 副作用编排 |
| H | `respond` | 纯函数 |
| H | `projectReport` | 纯函数 |
| H | `diagnosticProblem` | 纯函数 |
| H | `buildNextSteps` | 纯函数 |
| I | `inspectRepositoryState` | I/O 函数 |
| I | `resolveLocalSnapshot` | I/O 函数 |
| I | `fetchPrimary` | I/O 函数 |
| I | `compareCommits` | I/O 函数 |
| I | `createGitSnapshotReader` | 适配器构造 |
| I | `readGitBlobs` | I/O 函数 |
| J | `readEventStorage` | I/O 函数 |
| J | `readEventDelta` | I/O 函数 |
| J | `projectEventSnapshot` | 副作用编排 |
| J | `inspectEventHistory` | 副作用编排 |
| J | `eventStorageChanges` | 纯函数 |
| J | `validateDerivedCache` | 纯函数 |
| J | `readDerivedCache` | I/O 函数 |
| K | `buildIdeaScaffold` | 纯函数 |
| K | `writeIdeaScaffold` | 副作用编排 |
| K | `stateTransaction` | 副作用编排 |
| K | `recoverStateTransaction` | 副作用编排 |
| L | `parseProjectConfig` | 纯函数 |
| L | `inspectAdoption` | 副作用编排 |
| L | `resolveContentLanguage` | 纯函数 |
| L | `resolveOutputLanguage` | 纯函数 |
| L | `renderResponse` | 纯函数 |
| L | `serializeReport` | 纯函数 |
| L | `renderTuiMarkdown` | I/O 函数 |

例如 `compareCommits` 虽然不修改仓库，仍要读取真实 Git 历史，所以不是纯函数；
`recordObservation` 在此草案中只生成新状态和消息，发布消息由 sink 完成，所以
是纯函数；`renderResponse` 显式接收 now，不读真实时钟，也不输出到终端。

### A. CLI 适配

负责参数、输入文件、调用包装、输出选择和退出码，不判断生命周期。

```ts
normalizeCliOptions(
  command: CommandName,
  options: RawCliOptions,
): Result<CommandRequest, CliUsageError>;

readEventInput(
  source: EventInputSource,
  io: InputReader,
): Promise<EventBusinessRequest>;

selectOutputRenderer(
  options: OutputOptions,
  terminal: TerminalFacts,
): "json" | "markdown" | "tui";

exitCodeForReport(
  command: CommandName,
  report: Report,
): number;

executeCli(
  request: CommandRequest,
  handlers: CliHandlers,
  io: CliIO,
): Promise<number>;
```

参数归一化、renderer 选择与退出码映射是纯函数；输入读取、用例调用及输出是
副作用。按命令保留退出语义，不把所有受阻结果统一成一个退出码。保留
stdout/stderr、双 TTY 判定、human/agent/JSON 区别和 TUI 懒加载。

### B. 应用用例

每个函数表达一个明确意图，负责执行顺序与分支，不实现底层读写。

```ts
listIdeasUseCase(
  request: ListIdeasRequest,
  deps: ListIdeasDeps,
): Promise<Report>;

whatsNextUseCase(
  request: WhatsNextRequest,
  deps: WhatsNextDeps,
): Promise<Report>;

createIdeaUseCase(
  request: CreateIdeaRequest,
  deps: CreateIdeaDeps,
): Promise<Report>;

checkRepositoryUseCase(
  request: CheckRequest,
  deps: CheckDeps,
): Promise<Report>;

replayEventsUseCase(
  request: ReplayEventsRequest,
  deps: ReplayEventsDeps,
): Promise<Report>;

queryEventDeltaUseCase(
  request: EventDeltaRequest,
  deps: EventDeltaDeps,
): Promise<Report>;

appendEventUseCase(
  request: AppendEventRequest,
  deps: AppendEventDeps,
): Promise<Report>;
```

这些是副作用编排函数；事件读取、游标查询和追加分别表达其前置条件，不继续集中
在巨大的 operation switch 中。异常历史维护不设业务函数：维护者直接编辑完整
`events/` folder，再由 Git review 和 snapshot／event history 校验确认候选。

依赖按用例收窄：

| 用例依赖 | 所需能力与联网边界 |
| --- | --- |
| ListIdeasDeps | 本地项目观察、必要标题读取、命令消息输出；没有 fetch |
| CreateIdeaDeps | 项目观察、本地 readiness、时间与随机字节、脚手架写入；没有 fetch |
| WhatsNextDeps | 本地观察、仓库事实、显式 fetch、历史验证、快照绑定 guidance |
| CheckDeps | 明确目标快照与历史证据；只有 remote 路径显式 fetch |
| ReplayEventsDeps / EventDeltaDeps | 完整 replay 与精确游标后缀读取分别提供能力 |
| AppendEventDeps | 区分本地 ping/pong 与需要 primary 证据的状态写入 |
保留现有 `listIdeas`、`whatsNext`、`createIdea`、`checkRepository`、`eventCommand`
公共签名，通过薄包装接入内部用例，不新增公开命令。

### C. Device、project 与 idea 三层观察

读取并组装事实，返回来源坐标，不决定下一步动作。

```ts
observeDevice(
  request: DeviceObservationRequest,
  deps: DeviceReadDeps,
): Promise<ObservedDevice>;

observeProject(
  request: ProjectObservationRequest,
  device: ObservedDevice,
  deps: ProjectReadDeps,
): Promise<ObservedProject>;

observeIdea(
  request: IdeaObservationRequest,
  project: ObservedProject,
  deps: IdeaReadDeps,
): Promise<ObservedIdea>;

assembleObservation(
  facts: SnapshotFacts,
): InternalObservation;

selectIdea(
  ideas: readonly IdeaSummary[],
  selector: IdeaSelector | undefined,
): IdeaSelection;
```

前三个函数编排读取，后两个是纯函数。`observeDevice` 只识别当前运行来源，
观察全局 Silvermoon 安装以及全局配置的存在性、可读性和格式；源码 checkout
不依赖全局安装也必须如实返回事实。它不读取项目路径，也不探测 daemon 进程、
socket、握手、健康或会话。

`observeProject` 显式接收 device facts，不自行重读 device；它观察项目配置、
布局、语言、adoption、snapshot 与 diagnostics，但不读取具体 idea。
`observeIdea` 显式接收 project facts，只观察选中 idea 的身份、状态、world
revision、guidance 和历史来源，不重复观察 project/device。

project／idea 结果包含明确 snapshot target、commit/tree、内容来源与 diagnostics，
不混用工作区内容和 HEAD 版本标识。guidance 绑定该次 idea 快照，响应只能消费
该次观察所得内容，不能后来按路径重读。daemon 模式形成独立契约后才扩展
`ObservedDevice`；本轮不加入预留 daemon 字段或无实现 capability。

### D. Readiness 纯规则

将事实获取、策略判断与本地化指令组织分开。

```ts
evaluateLocalReadiness(
  facts: LocalRepositoryFacts,
  requirement: "navigation" | "creation",
): ReadinessAssessment;

evaluatePrimaryRelation(
  facts: PrimaryRelationFacts,
): ReadinessAssessment;

evaluateHistoryReadiness(
  evidence: EventHistoryEvidence,
): ReadinessAssessment;
```

不提供大量可自由组合的 readiness 开关。creation 要求干净工作区和正确 primary
upstream，不限制本地分支名；navigation 通过本地检查后，用例才允许 fetch 并判断
primary 关系。查询和本地 check 不套用导航 readiness。

### E. 生命周期与查询规则

保留已有纯算法，不为换目录重写。

```ts
deriveIdeaState(
  status: IdeaStatus,
  revisions: WorldRevisions,
): IdeaLifecycleState;

normalizeIdeaQuery(
  input: IdeaQueryInput,
): NormalizedIdeaQuery;

queryIdeaInventory(
  items: readonly IdeaInventoryItem[],
  query: NormalizedIdeaQuery,
): IdeaInventory;

extractIdeaTitle(
  source: string,
): string | null;
```

标题读取由用例按查询需要触发，不能为统一观察入口而全量读取所有契约。
生命周期仍基于规范状态事实和准确 world revisions，不能从 ledger 推断批准。

### F. 持久事件规则与变更规划

只处理事实、规范记录与允许的变化，不执行写入。

```ts
parseEventRequest(
  input: unknown,
  sequence: number,
  format: EventFormat,
): Result<IdeaEvent, EventFormatProblem>;

reduceIdeaEvent(
  before: IdeaEventState,
  event: IdeaEvent,
  format: EventFormat,
): EventReduction;

replayIdeaEvents(
  ideaId: IdeaId,
  events: readonly IdeaEvent[],
  format: EventFormat,
): EventReplayResult;

validateHumanDecision(
  event: DecisionEvent,
  facts: HumanGateFacts,
): Result<void, DecisionProblem>;

planEventAppend(
  request: AppendEventRequest,
  facts: VerifiedAppendFacts,
): Result<EventWritePlan, EventChangeProblem>;

planEventRevision(
  request: ReviseEventsRequest,
  facts: VerifiedRevisionFacts,
): Result<EventWritePlan, EventChangeProblem>;
```

`HumanGateFacts` 包含当前状态、准确 world revision、primary 上对应 revision 和
明确人工决定事实。CLI 确认参数只表达调用方声明，不能自己生成授权。
`VerifiedAppendFacts` 包含精确长度、folder digest、归约状态，以及适用的 primary
与 history 证据，不是只有事件数组。

规划返回规范字节变更和前置条件，不获取“最新 primary”、不生成批准、不修改
原事件流。采用投影状态的规划不得强制完整 replay；投影所需证明由验证读路径提供。

### G. 命令运行时

纯 reducer 与 trace、副作用执行分离。运行状态显式传递，不依赖可变服务类。

```ts
initialInternalObservation(): InternalObservation;

reduceObservation(
  state: InternalObservation,
  message: CommandMessage,
): InternalObservation;

startCommand(
  intention: Intention,
): CommandTransition;

recordObservation(
  run: CommandState,
  fact: ObservationFact,
): CommandTransition;

requestAction(
  run: CommandState,
  action: ActionRequest,
): RequestedActionTransition;

finishAction(
  run: CommandState,
  actionId: ActionId,
  completion: ActionCompletion,
): CommandTransition;

completeCommand(
  run: CommandState,
  observation: InternalObservation,
  context: ResponseContext,
): CompletedCommand;

type CommandTransition = Readonly<{
  state: CommandState;
  emitted: readonly CommandMessage[];
}>;

performAction<T>(
  run: CommandState,
  spec: ActionSpec<T>,
  execute: (actionId: ActionId) => Promise<T>,
  sink: CommandMessageSink,
): Promise<ActionExecution<T>>;
```

transition 返回新状态和消息，不修改传入状态。`performAction` 是副作用外壳，
返回完成后的状态与结果；保留 action 请求／完成配对、嵌套 action 的既有顺序、
失败消息和异常传播。实现时必须明确如何把嵌套执行产生的状态返回外层，不能用
旧状态覆盖其消息。sink 显式接入 trace，失败不可静默丢弃。
不自动重试业务 action，也不构建通用 effect 引擎。

### H. 响应组织

从 intention 与最终内部 observation 生成 response，不访问仓库。

```ts
respond(
  intention: Intention,
  observation: InternalObservation,
): Response;

projectReport(
  messages: readonly CommandMessage[],
): Report;

diagnosticProblem(
  diagnostic: Diagnostic,
  outputLanguage: OutputLanguage,
): Problem;

buildNextSteps(
  decision: NextStepDecision,
  context: InstructionContext,
): readonly string[];
```

这些都是纯函数。`InstructionContext` 保留原始 selector、audience、临时输出语言
和创建／跟进意图，避免 hygiene 重试变成其他操作。结构化响应与 Markdown 渲染
分开，response 不从展示文本反推状态。

### I. Git 与快照读写

明确区分本地读取与联网获取，保留批量读取。

```ts
inspectRepositoryState(
  root: RepositoryRoot,
): LocalRepositoryFacts;

resolveLocalSnapshot(
  root: RepositoryRoot,
  target: LocalSnapshotTarget,
): SnapshotRef;

fetchPrimary(
  root: RepositoryRoot,
  primary: PrimaryConfig,
): PrimaryRef;

compareCommits(
  root: RepositoryRoot,
  local: CommitId,
  primary: CommitId,
): CommitRelation;

createGitSnapshotReader(
  ref: SnapshotRef,
  options: SnapshotReadOptions,
): SnapshotReader;

readGitBlobs(
  root: RepositoryRoot,
  objects: readonly GitObjectId[],
): readonly Buffer[];
```

这些函数提供明确的基础设施能力；本地读取不隐藏 fetch。保留批量读取、预加载
选择、SHA-1/SHA-256 和明确树坐标，不退化成逐文件子进程。工作区快照的受控
临时 index 行为与 remote check 不修改调用方分支、index、工作区的边界保持不变。

### J. 事件存储、历史证据与派生缓存

存储负责字节、段和快照；历史模块负责证明；缓存仅加速，不是事实权威。
以下职责不要求合并成一个物理模块。

```ts
readEventStorage(
  request: EventStorageRequest,
  reader: SnapshotReader,
): Promise<EventStorage>;

readEventDelta(
  request: EventDeltaRequest,
  reader: SnapshotReader,
): Promise<EventDelta>;

projectEventSnapshot(
  request: EventProjectionRequest,
  deps: EventProjectionDeps,
): Promise<VerifiedEventProjection>;

inspectEventHistory(
  request: EventHistoryRequest,
  deps: EventHistoryReadDeps,
): Promise<EventHistoryEvidence>;

eventStorageChanges(
  storage: EventStorage,
  candidate: EventCandidate,
  format: EventFormat,
): readonly FileChange[];

validateDerivedCache(
  entry: unknown,
  expected: CacheCoordinates,
): CacheValidation;

readDerivedCache(
  key: CacheKey,
  store: DerivedCacheStore,
): Promise<CacheReadResult>;
```

变更计算与缓存验证是纯函数，其他函数显式读取。保持每段最多 1000 条、
记录字节限制、规范字节和 folder Git digest。`EventDelta` 只代表游标后缀，
不冒充完整 replay，不自动重置失效游标。

缓存缺失或失效进入现有规定的验证路径；读取失败、未知内容不得伪装成命中。
保留认证派生缓存及增量 append 的预算，不强制重新读取和归约全部历史。
本地 ping/pong 继续保留不 fetch primary 的精确流写入路径。

### K. 脚手架与状态事务

两个独立写入能力，不统一为普通 `writeFiles`。

```ts
buildIdeaScaffold(
  input: ScaffoldInput,
): ScaffoldPlan;

writeIdeaScaffold(
  plan: ScaffoldPlan,
  deps: ScaffoldWriteDeps,
): Promise<ScaffoldReceipt>;

stateTransaction(
  root: RepositoryRoot,
  plan: StateWritePlan,
  hooks: TransactionValidationHooks,
): Promise<TransactionReceipt>;
```

脚手架规划是纯函数，输入显式提供已生成 ID、时间和内容语言；写入函数仍负责
操作所有权与失败清理，只能清理本次操作仍拥有的内容。

事务保留锁、精确 before/after 字节和应用前后验证。规划时的验证不能替代锁内
再验证。失败时保留可诊断现场，不自动重放过时决定；异常历史由维护者直接编辑
完整 `events/` folder，并通过 Git review 与校验确认，不提供恢复业务入口。

### L. 配置、语言、资源与展示

分别保持小模块，不合并成“公共工具”。

```ts
parseProjectConfig(
  source: string,
): Result<ProjectConfig, readonly Diagnostic[]>;

inspectAdoption(
  request: AdoptionRequest,
  deps: AdoptionReadDeps,
): Promise<AdoptionFindings>;

resolveContentLanguage(
  facts: ContentLanguageFacts,
): ResolvedContentLanguage;

resolveOutputLanguage(
  input: OutputLanguageInput,
): ResolvedOutputLanguage;

renderResponse(
  response: Response,
  context: { now: Date },
): string;

serializeReport(
  report: Report,
): string;

renderTuiMarkdown(
  markdown: string,
  terminal: TerminalIO,
): Promise<void>;
```

项目接入读取和 TUI 执行是副作用，其他函数是纯转换。内容语言与输出语言使用
不同语义类型和函数，保留创建时持久 override 与报告时临时 override 的区别。
日期展示显式接收 now。配置、skill、guidance 与包资源定位各有明确读取能力，
不能在默认组装时额外读取或联网。展示不重判业务状态或执行仓库操作。

## 用例编排示例

`whats-next` 的执行顺序应当直接可读：

1. 观察明确快照。
2. 纯函数判断项目与本地 readiness；受阻则完成报告。
3. 显式 fetch primary，并记录 action。
4. 获取提交关系和必要历史证据。
5. 纯函数判断同步条件；受阻则完成报告。
6. 选择 idea，确定内容语言与生命周期。
7. 获取该快照绑定的 phase guidance。
8. 完成命令消息流与四投影报告。

不将流程隐藏到 `RepositoryService.run()`，也不用统一函数为所有命令自动 fetch。
创建用例只复用本地事实读取与纯 readiness，不调用导航用例。

## 后续收敛与验证边界

本文件列出关键接口，不声明已经完成类型定义、模块实现或测试。理想契约获准确
版本批准后，实施阶段再收敛具体接口、依赖函数集合、嵌套命令 action 的状态
传递方案与分批迁移顺序，并展开对应实施契约和 ledger。

验证至少覆盖纯规则无 I/O、模块无反向依赖、用例执行顺序、不同命令联网和退出码
区别、四投影 shape、公共 API 与 Agent 子路径、TTY/TUI、语言、快照来源、
增量 I/O 预算、并发失败与异常历史校验。不能削弱既有断言或用完整历史读取掩盖
增量退化。
新增本文与契约链接会改变 idealRevision；之前的 revision 不代表这份新增内容。
