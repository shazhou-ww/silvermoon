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
| B | `reviseEventsUseCase` | 副作用编排 |
| B | `recoverEventsUseCase` | 副作用编排 |
| C | `observeProjectSnapshot` | 副作用编排 |
| C | `observeIdeaSnapshot` | 副作用编排 |
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

reviseEventsUseCase(
  request: ReviseEventsRequest,
  deps: ReviseEventsDeps,
): Promise<Report>;

recoverEventsUseCase(
  request: RecoverEventsRequest,
  deps: RecoverEventsDeps,
): Promise<Report>;
```

这些是副作用编排函数；事件读取、游标查询、写入、修订和恢复分别表达其前置条件，
不继续集中在巨大的 operation switch 中。

依赖按用例收窄：

| 用例依赖 | 所需能力与联网边界 |
| --- | --- |
| ListIdeasDeps | 本地项目观察、必要标题读取、命令消息输出；没有 fetch |
| CreateIdeaDeps | 项目观察、本地 readiness、时间与随机字节、脚手架写入；没有 fetch |
| WhatsNextDeps | 本地观察、仓库事实、显式 fetch、历史验证、快照绑定 guidance |
| CheckDeps | 明确目标快照与历史证据；只有 remote 路径显式 fetch |
| ReplayEventsDeps / EventDeltaDeps | 完整 replay 与精确游标后缀读取分别提供能力 |
| AppendEventDeps | 区分本地 ping/pong 与需要 primary 证据的状态写入 |
| ReviseEventsDeps / RecoverEventsDeps | 精确日志、授权、历史与事务验证；不自动重放 |

保留现有 `listIdeas`、`whatsNext`、`createIdea`、`checkRepository`、`eventCommand`
公共签名，通过薄包装接入内部用例，不新增公开命令。

### C. 项目与快照观察

读取并组装事实，返回来源坐标，不决定下一步动作。

```ts
observeProjectSnapshot(
  request: ProjectObservationRequest,
  deps: ProjectReadDeps,
): Promise<ObservedProject>;

observeIdeaSnapshot(
  request: IdeaObservationRequest,
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

前两个函数编排读取，后两个是纯函数。观察结果包含明确 snapshot target、
commit/tree、内容来源与 diagnostics，不混用工作区内容和 HEAD 版本标识。
guidance 绑定该次快照，响应只能消费该次观察所得内容，不能后来按路径重读。

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

recoverStateTransaction(
  root: RepositoryRoot,
  request: RecoveryRequest,
  hooks: RecoveryValidationHooks,
): Promise<RecoveryReceipt>;
```

脚手架规划是纯函数，输入显式提供已生成 ID、时间和内容语言；写入函数仍负责
操作所有权与失败清理，只能清理本次操作仍拥有的内容。

事务保留锁、精确 before/after 字节、持久恢复计划、应用前后验证、原 writer
停止确认与显式恢复授权。规划时的验证不能替代锁内再验证。恢复发现 primary、
world revision 或未知字节变化时保留现场，不重放过时决定。

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
增量 I/O 预算、并发失败与恢复。不能削弱既有断言或用完整历史读取掩盖增量退化。
新增本文与契约链接会改变 idealRevision；之前的 revision 不代表这份新增内容。
