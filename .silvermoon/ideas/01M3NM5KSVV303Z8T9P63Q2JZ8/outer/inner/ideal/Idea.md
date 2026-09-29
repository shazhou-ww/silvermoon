# 以事件流重构命令运行时与响应协议

## 意图

把 Silvermoon command 建模为由 normalized intention 启动、通过有序 domain
messages 迭代 observation、记录实际 actions，并最终以纯函数生成 response 的
运行时；同时将这些 domain messages 的安全投影与现有 performance trace 统一
到同一条可关联的 run event stream。

## 背景

当前 dialogue commands 返回
`{ intention, observation, outcomes, instructions }`。这个结构让调用意图、
项目事实、副作用结果和下一步文字可被检查，但实现仍主要由命令式控制流拼装：

- command 入口直接构造 intention，在多个 early-return 分支中创建 envelope；
- observation 由若干阶段性对象替换和扩展，没有显式 message/reducer contract；
- side effect 通过可变 `outcomes` 数组记录，重要结果仍可能只存在于本地化
  `summary`；
- `instructions` 假设每个回答都是命令调用者执行下一步，但 create、check、
  inventory、choice、blocked 和 terminal 场景并不都属于 instruction；
- 默认 Markdown 按四个内部组成部分逐段展示，调用者必须从过程报告中寻找真正
  回答。

现有 `--trace` 是独立的 performance instrumentation：使用 span-start/span-end、
parent span、timestamp 和 duration 记录内部调用。它能说明“哪里耗时”，却不能
解释“哪些业务事实依次被观察、为何执行某个 action、最终状态如何形成”。反过来，
把完整 domain payload 直接倒入 trace 又会破坏当前对 Git 输出、文件正文和潜在
敏感信息的克制边界。

刚引入的 phase guidance 进一步说明了问题：repository-owned 内容既是被观察到
的事实，也是最终 response 的一部分；它需要 snapshot provenance、结构化
隔离和确定性渲染，而不应继续依赖一个万能 instructions string。

## 期望结果

### 一个有序的 domain message stream

每次合法 command invocation 都在参数规范化后产生一条
`intention.accepted` 作为首个 domain message。后续 project、repository、
idea、guidance 和 command-specific facts 通过带稳定 type 与结构化 payload 的
`observation.*` messages 进入同一个有序 stream。

外部读取通过 `probe` effect 完成并产生 observation messages；fetch、scaffold
创建与 owned-path cleanup 等对外部世界有意义的副作用通过
`action.requested` 和 `action.finished` 成对记录，使用同一 run 内唯一 action
ID。Domain messages 使用稳定 code、identifier、path、revision、count 和
value，不以本地化 prose 作为唯一事实。

不为 intention、observation 和 actions 分别维护彼此可能漂移的可变数据源。
最终 intention、observation 与 actions 都由同一 ordered domain stream 投影。

### Observation 是 reducer 维护的状态

唯一的 observation reducer 以初始空状态和 domain message 计算新的 immutable
state。它显式表达已观察到的边界、可信 facts、command progress 与 problems，
拒绝不合法的状态跃迁，而不是让每个 early-return branch 自行拼装相似对象。

Action history 不直接决定 response，但凡 action result 会改变调用者接下来应该
做什么，就必须被转换成 observation fact：

- fetch 成功产生 observed primary tip，随后才能推导 ancestry；
- fetch 失败产生 blocking problem；
- scaffold 成功产生 created idea；
- 创建失败与 cleanup 结果产生准确 residual-state facts。

只用于审计且不改变最终决策的 action result 可以只保留在 actions projection。
任何成功或失败都不能只存在于 trace 或自然语言 summary 中。

### Actions 是已执行副作用的投影

顶层 `outcomes` 更名为 `actions`。它只表示 Silvermoon 在本次 invocation 中已经
请求并尝试的外部操作，不包含推荐给调用者的未来步骤。每项至少包含 action ID、
稳定 type、`success|failure` status 和结构化 result/problem；显示文案由
response/renderer 生成。

`actions` 从 `action.requested`/`action.finished` messages 投影，不由执行路径
另行 push 到独立数组。一个形成最终 report 的正常 run 不得留下无法解释的
requested-only action；进程崩溃时的未完成 action 只可能出现在可选 trace。

### Response 是纯函数

顶层 `instructions` 被结构化 `response` 取代：

```text
response = respond(intention, finalInternalObservation)
```

`respond` 不读取 filesystem、Git、network、clock、randomness、trace 或 actions
projection。显式 output-language override 来自 intention，项目/用户内容语言及
其他已解析事实来自 observation，因此 localization 仍是确定性的纯转换。

Response 使用 command-specific discriminated variants，而不是一个万能 prose
string。它至少有稳定 `kind` 和面向调用者的 `summary`，并可按场景携带
`nextSteps`、choices、created resource、validation result、idea items 或
phase guidance。未来步骤只属于 `response.nextSteps`，不进入 actions。

Response 必须自足到足以产生默认文本输出。它可以重复展示 observation 中的
结构化事实，但这种重复必须完全由纯函数派生并通过一致性测试约束，不能成为
第二个 source of truth。Phase guidance 等较大内容可以保留完整 internal
observation fact，在 public observation 中暴露 provenance，并由 response
携带调用者需要看到的正文。

### 统一的最终 report 与输出通道

所有 public commands 的 JSON 成功或可信阻塞报告统一为四个最终 projection：

```json
{
  "intention": {},
  "observation": {},
  "actions": [],
  "response": {}
}
```

- `intention` 是规范化后的调用请求；
- `observation` 是稳定、安全的 final state projection；
- `actions` 是本次实际副作用记录；
- `response` 是调用者应看到的最终回答。

`--json` 在 stdout 输出完整四元组。默认 Markdown 只渲染 `response`，不把
intention、observation 和 actions 按内部处理阶段逐段打印；response 可选择性
呈现其结论所需的 ID、path、revision、problem 或 action consequence。

stderr 只用于 CLI usage error 和无法形成可信 report 的 internal failure。
Domain messages、正常 blockers、业务 action failures 和 supporting facts 都
不得拆到 stderr。这样 stdout 保持一个原子结果，shell、SDK、CI 和 Agent 不必
合并两个顺序不可靠的 stream。

### Domain events 与 performance trace 整合

Domain message bus 无论是否提供 `--trace` 都在内存中完整运行，所有 reducer、
projection 和 response 计算只依赖该内存语义。Trace 是可选 subscriber；打开
或关闭 trace 不得改变 effect 决策、最终 observation、actions 或 response。

现有 perf spans 与 domain event 的安全投影写入同一个 `.trace.jsonl`，共享
`traceId`、全局递增 sequence 和 timestamp，并由明确 channel 区分：

- `channel: "domain"`：intention、observation transition、action lifecycle 和
  response kind/hash 的安全摘要；
- `channel: "telemetry"`：现有 span start/end、parent span、duration 和 error
  class。

Trace schema 升级并保持每个 event 可独立解析。Action ID 与 span ID 可关联，
使一次 fetch 或 scaffold mutation 的业务结果和耗时属于同一 run timeline；
telemetry event 永远不进入 observation reducer。

内存 domain messages 可以包含 reducer 所需的完整 typed payload，但 trace 只
使用显式 allowlist/redaction：不得记录 phase-guidance/文件正文、Git argv、
stdout/stderr、environment、credential、token 或其他潜在敏感内容。Trace
保留当前 opt-in、buffered、exclusive-create 行为；完整可重放持久 journal、
实时 stdout/stderr streaming、sampling 与跨进程聚合不属于首版。

### 错误、重放与不变量

预期的 project/repository/action failure 通过 domain messages 进入 observation，
再生成可信 blocked response；usage error 在 intention 被接受前以 exit `2`
失败；reducer invariant、程序错误或无法形成可信 report 的异常以 exit `1`
进入 stderr，并在启用 trace 时结束相关 error span。

测试必须证明：

- 相同 ordered domain messages 总是归约为相同 observation、actions 和 response；
- 删除全部 telemetry events 不改变任何 domain projection；
- trace on/off 产生相同 report；
- response 不读取 actions，但 action 的 relevant consequence 已进入 observation；
- event type、sequence、action/span correlation 和 schema version 稳定；
- response 与 observation 中的重复事实永不漂移。

完整 Haskell 风格伪代码、trace event 示例和性质测试见
[Command Event Model Reference](./Event-model-reference.md)。

### 0.2.0 的 RC-first 发布

这是一次有意的 public JSON 与默认文本协议变更，最终稳定发布目标为
`silvermoon@0.2.0`。不得在首次进入 deploying 时直接发布 stable：

1. implementation 首先准备并验证 `0.2.0-rc.1` candidate；
2. 获得 exact implementation revision 的明确验收后，再由用户显式调用发布
   流程创建不可变 `npm/silvermoon/v0.2.0-rc.1`，发布到 npm `rc` dist-tag；
3. 从 registry 安装 RC，验证全部 commands、domain/action projections、
   response-only Markdown、unified trace、phase guidance 和真实消费者行为；
4. 任一缺陷都回到 implementing，以新的 main commit 和递增
   `0.2.0-rc.N` 修复、重新验收和发布，不移动既有 tag/version；
5. RC 证据通过后，显式回到 implementing，将 manifest 与相关版本引用准备为
   `0.2.0`，形成新的 implementation revision 并再次请求人类验收；
6. 只有第二次验收和独立发布授权后，才发布不可变
   `npm/silvermoon/v0.2.0` 到 `latest`，完成稳定版核验并请求 deployment
   acceptance。

RC 与 stable 都使用现有 main-reachable tag、GitHub Actions trusted publishing、
单一 tarball、provenance 和 registry verification 流程。进入 deploying、
批准本 ideal 或验收 implementation 都不构成 `/publish` 授权。

## 范围

### 范围内

- 定义 versioned typed domain messages、observation reducer、effect driver、
  action lifecycle 和四个 final projections。
- 将 `whats-next`、`create-idea`、`check` 及本 idea 实现时已经公开的
  `list-ideas` command 迁移到统一 report model。
- 以结构化 response variants 替换顶层 instructions，并让默认 Markdown
  answer-first、只渲染 response。
- 以 actions 替换 outcomes，结构化已执行 side-effect result，并保证未来步骤
  只存在于 response。
- 将 phase guidance、language resolution、problems、created resources、
  validation 与 inventory 结果纳入纯 response projection。
- 建立共享 run event sequencing，把 domain safe projections 与现有 perf spans
  写入同一 trace schema。
- 更新 public API、CLI help、reference/operations/getting-started、canonical
  skill、trace docs、tests 和 package consumers。
- 准备并验证 `0.2.0-rc.1` implementation candidate，以及 RC 通过后的稳定
  `0.2.0` candidate。

### 范围外

- 把 stdout/stderr 改成实时 domain event transport，或让默认文本输出内部
  intention/observation/action stream。
- 让 trace 成为 reducer、response 或业务状态的 source of truth。
- 在 trace 中保存完整可重放 domain payload、repository file/guidance 内容、
  Git 原始输出、环境变量或 credentials。
- 引入 durable event store、跨 command replay、event sourcing database、
  distributed tracing backend、sampling 或跨进程 aggregation。
- 让 response 执行 IO、读取 actions history，或依据 wall clock/randomness
  产生不同业务结论。
- 保留 `outcomes`/`instructions` 与 `actions`/`response` 两套并行 public
  protocol；0.2.0 采用单一明确的新合同。
- 在首次 deploying 时直接发布 stable `0.2.0`，移动/覆盖 prerelease tag，
  或以切换 dist-tag 冒充真正的 SemVer RC。

## 约束

- Domain message schema 与 trace schema 必须显式版本化；event payload 使用
  stable machine fields，localization 只能发生在 response projection。
- Message sequence 是单次 run 的严格总序；action request/result 必须以唯一
  action ID 配对，相关 perf span 使用显式关联字段而非依赖相邻顺序。
- Reducer 与 response generator 必须是无副作用纯函数。Effect planning 也应
  由 intention/observation 决定，IO 仅存在于可注入、可测试的 probe/action
  interpreters。
- Public observation 不得因安全 projection 隐藏 response 所需事实；若隐藏
  大型 payload，internal observation 仍须保留并确定性地产生 self-contained
  response。
- Action result 影响下一步时必须进入 observation；actions array 不能成为
  response 的隐式第二输入。
- Trace sink 必须可完全替换为 no-op；启用、写入或关闭 trace 不能改变 domain
  event order、effect count 或 final report。Trace serialization 必须继续防止
  覆盖已有文件。
- 默认 stdout 必须只含完整、可独立消费的 response rendering；`--json` 必须
  只在 stdout 输出完整四元组，成功路径不得产生 stderr noise。
- 这是一项 public report protocol breaking change。所有命令、文档、fixtures、
  packaged skill 和 active feature integration 必须在同一 0.2.0 line 上收敛；
  不得让部分命令继续返回旧字段。
- 已批准但尚未实现、且明确约定旧 report shape 的 idea 必须在集成前按其自身
  lifecycle 重新协调；不能用本 idea 静默覆盖其他 exact revision 的人类决定。
- `0.2.0-rc.1` 和 `0.2.0` 的 manifest、tag 与 registry version 必须逐字一致。
  发布前重新查询 npm 和 Git tags；若目标已存在，停止并取得新的明确版本决定。
- RC 发布不得更新 npm `latest`；stable 发布不得在 RC 外部验证、第二次
  implementation acceptance 或显式 `/publish` 授权之前发生。
