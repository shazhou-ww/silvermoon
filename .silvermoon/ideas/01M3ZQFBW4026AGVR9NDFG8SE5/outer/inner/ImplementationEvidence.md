# CLI 职责重构实施验证证据

本文件服务于 [Implementation](./Implementation.md)，不构成额外契约或人工验收。
已批准的 [Idea](./ideal/Idea.md) 与 [函数式设计](./ideal/FunctionalDesign.md) 保持不变。
实施基线为 `aa15bac8cbe3e4bf306d698343f0a9dfe06306d4`；
批准的 idealRevision 为 `7352fc3a3a42640ed873d0f22e75cc4e3450be14`。

## 职责与接口落地

保持现有平面模块路径，使用新增的小职责模块，不进行目录大搬迁。
公共包入口只导出；内部 use case 使用按需的函数 ports 和默认组装。
没有通用服务、Context、命令总线或依赖注入容器。

| 职责 | 落地模块与关键函数 |
| --- | --- |
| 公共组装 | [index.js](../../../../../src/index.js) 仅有受控 export；公共符号与 Agent 子路径不变 |
| CLI 适配 | [cli.js](../../../../../src/cli.js) 保留参数、输入、trace、输出选择、退出码及 TUI 懒加载；检查直接调用内部检查模块 |
| 检查用例 | [check-repository.js](../../../../../src/check-repository.js) 的 checkRepositoryUseCase；兼容包装 checkRepository |
| 查询用例 | [list-ideas.js](../../../../../src/list-ideas.js) 的 listIdeasUseCase；兼容包装 listIdeas |
| 纯查询规则 | [idea-query.js](../../../../../src/idea-query.js) 的 normalizeIdeaQueryCore、queryIdeaInventoryCore 显式接收枚举事实；公共包装保持既有枚举导出与默认值语义 |
| 导航用例 | [whatsnext.js](../../../../../src/whatsnext.js) 的 whatsNextUseCase；兼容包装 whatsNext |
| 创建用例 | [create-idea.js](../../../../../src/create-idea.js) 的 createIdeaUseCase；兼容包装 createIdea 与 generateUlid |
| 事件用例 | [event-command.js](../../../../../src/event-command.js) 的 eventCommandUseCase；兼容包装 eventCommand |
| 共享 readiness | [repository-readiness.js](../../../../../src/repository-readiness.js) 的 assessRepositoryReadinessWith 与既有 readiness 包装；事实读取、fetch、提交关系与历史观察显式编排 |
| 纯 readiness 规则 | [readiness-policy.js](../../../../../src/readiness-policy.js) 的 evaluateLocalReadiness、evaluatePrimaryRelation |
| 纯指令组织 | [instructions.js](../../../../../src/instructions.js) 的项目、guidance、生命周期及卫生重试指令；保留原命令意图、selector 与语言 |
| 观察投影 | [observation-projection.js](../../../../../src/observation-projection.js) 的 projectObservation、incompleteObservation、unavailableObservation、repositoryProblemObservation；读取仍在 [observation.js](../../../../../src/observation.js) |
| 命令纯规则 | [command-rules.js](../../../../../src/command-rules.js) 的 reduceObservation、replayObservation、projectReport、响应 metadata 与不变量 |
| 命令副作用运行时 | [command-runtime.js](../../../../../src/command-runtime.js) 的 createCommandRun、driveCommand 与 CommandRun 兼容适配 |
| 命令兼容入口 | [domain.js](../../../../../src/domain.js) 保留既有规则与运行时导出，不混入实现 |
| 结构化 response | [response-projection.js](../../../../../src/response-projection.js) 的 respond；只从 intention 与最终内部 observation 生成响应 |
| 纯 Markdown 展示 | [markdown.js](../../../../../src/markdown.js) 的 renderMarkdownResponse；显式接收 now 与 dateFacts |
| 展示兼容包装 | [response.js](../../../../../src/response.js) 的 renderResponse 保留默认时钟和本地时区日期行为；重新导出 respond |
| 事件纯策略与规划 | [event-policy.js](../../../../../src/event-policy.js) 的 parseRequest、assertHumanGate、planProjectedAppend、planFullEventChange、assertIntroducedDecisions |
| 完整 replay | [event-replay.js](../../../../../src/event-replay.js) 的 replayStoredEvents；格式、归约与本地未 fetch baseline 保持不同信息 |
| 事件候选观察 | [event-observation.js](../../../../../src/event-observation.js) 的 inspectCandidate、resolveIdea；保留准确 ULID 修复路径和未知 pending 字节保护 |
| 增量与本地事件写入 | [event-write.js](../../../../../src/event-write.js) 的 appendLocalInteraction、appendProjectedInteraction、appendProjectedMetadata、writeProjectedAppend |
| 完整事件写入 | [event-full-write.js](../../../../../src/event-full-write.js) 的 writeFullEvents；完整历史、授权修订、精确重试与事务验证 |
| 事件恢复 | [event-recovery.js](../../../../../src/event-recovery.js) 的 recoverEvents；保留原 writer、准确 primary、世界版本和字节校验 |
| 纯事件 digest | [event-digest.js](../../../../../src/event-digest.js) 的 segmentName、gitContentDigest、eventFolderBytes、eventFolderDigest；保留 Git SHA-1/SHA-256 |
| 事件流兼容 | [event-stream.js](../../../../../src/event-stream.js) 保留 EventStream、分段与 onHash 观察语义，调用纯 digest 核心 |
| 认证投影 | [event-projection.js](../../../../../src/event-projection.js) 的 runtime identity 纳入抽出的 event-digest 实现，避免未来摘要代码变化沿用旧缓存 |
| 纯脚手架规划 | [scaffold-plan.js](../../../../../src/scaffold-plan.js) 的 buildIdeaScaffold；输入包含准确 id、格式版本及内容语言 |
| 脚手架写入与清理 | [idea-scaffold.js](../../../../../src/idea-scaffold.js) 保留 ID 竞争、独占创建与操作所有权清理，独立于状态事务 |
| 纯 ULID 编码 | [ulid.js](../../../../../src/ulid.js) 的 encodeUlid；默认时钟与随机字节只在兼容包装获取 |
| 配置规则与读取 | [config-policy.js](../../../../../src/config-policy.js) 的 parseConfigSource、serializeConfig、validPrimaryBranch；[config.js](../../../../../src/config.js) 保留本地和 Git 快照读取 |
| 接入策略与资源观察 | [adoption-policy.js](../../../../../src/adoption-policy.js) 的 evaluateNpmAdoption 与安装／skill 指令；[adoption.js](../../../../../src/adoption.js) 保留资源定位、实际版本、manifest 和 skill 读取 |
| guidance 规则与读取 | [guidance-policy.js](../../../../../src/guidance-policy.js) 的 inspectContent 与诊断规则；[guidance.js](../../../../../src/guidance.js) 保留 Git／文件读取及快照 provenance |

Git、快照 reader、事件存储、派生缓存和状态事务继续使用既有基础设施，没有
新增存储权威、格式迁移、授权规则、产品命令、Agent 会话功能或 npm 发布。
现有语言、查询、状态与持久事件纯函数也增加 @pure，保留其业务名称与算法。

## 草案收敛说明

- 未机械新增草案中的每一个函数名。纯状态转换由既有 reduceObservation 及独立
  投影函数承担；副作用外壳使用每次调用独立的闭包状态，避免嵌套 action 的旧
  状态覆盖新消息。原 CommandRun 类仅作为公共兼容适配，不用于内部服务架构。
- 兼容适配保留可写的自有 eventSink、子类方法 dispatch 和构造时观察回调。
  新测试验证独立运行、嵌套 action 请求／完成顺序和四投影 shape。
- 纯冻结辅助函数复制后冻结自己的数据，不冻结调用方对象；测试验证输入不变。
- 查询默认枚举原本是可变的公共数组，未通过强行冻结改变 API。公共包装读取
  其事实快照，纯查询核心显式接收枚举；测试同时验证核心输入不变与既有公共
  数组可变行为。非纯的默认值包装不冒充 @pure。
- 纯展示不隐式读取时钟，也不依赖 Date 的本地时区解析。默认包装将时间戳毫秒值
  与本地日历日期作为 dateFacts 传入，保留原有本地绝对日期展示。
- 纯 digest 不调用 onHash；既有 EventStream 适配继续在原逻辑位置报告实际哈希
  输入，保留观测预算。增量规划没有被替换为完整历史扫描。
- 查询语言独立用例原先嵌套注册且未被父测试等待；改为顶级独立注册，保留所有
  原断言，避免并发负载或 Promise 调度差异导致其被取消。
- 严格包文件白名单增加准确的 22 个源码文件，没有放宽为通配符；CI 契约保留
  原检查集并增加纯度 gate。

## 纯函数标注与检查

[pure-check.mjs](../../../../../scripts/pure-check.mjs) 使用已有 TypeScript AST 和词法
symbol，不新增运行时依赖。`pnpm check:pure` 覆盖 144 个标注函数、13 个规则模块，
并接入 sanity 与完整 release check。

检查模块反向依赖、已知 I/O 和外部状态、隐式时间／随机、未确认调用与回调、
可识别的输入别名／共享状态修改、缺失标注。外部函数与标准方法使用显式审核
清单。纯度单元测试全部通过，覆盖合法的局部 mutation、同名词法变量、显式
时间、纯 helper 和 re-export，也覆盖 I/O 别名、输入修改和动态调用等反例。

静态检查不是任意 JavaScript 的数学纯度证明。动态 receiver 类型、复杂别名流、
反射、运行时 monkey-patching 和第三方内部行为仍需审核。不得把 @pure 视为
授权豁免，或用白名单绕过失败；保留 sanity I/O guard 与行为测试。

维护入口已更新：[maintaining.md](../../../../../docs/maintaining.md)。

## 验证结果

环境：macOS，Node `v22.22.2`，pnpm `11.22.0`。全部使用当前 checkout 的源码
入口，未安装 Silvermoon 发布包，未修改版本或发布 npm。
针对性命令按分批执行时的实际结果记录；最后的完整检查覆盖最终代码。

| 实际命令 | 结果 |
| --- | --- |
| `pnpm check:sanity` | 通过；142 项测试全部通过，含纯度检查和 schema/API 契约 |
| `node --test test/contract/functional-boundaries.test.js test/runtime/event-state.test.js test/integration/create-idea-scaffold.test.js test/integration/create-idea-transactions.test.js` | 通过；38 项测试全部通过，覆盖依赖图、创建竞争与恢复观察 |
| `node --test test/contract/functional-boundaries.test.js test/runtime/event-state.test.js test/runtime/segmented-events.test.js test/runtime/cursor-events.test.js test/runtime/event-v2-interaction.test.js` | 通过；27 项测试全部通过，覆盖完整／增量事件、认证缓存和恢复 |
| `node --test test/runtime/adoption.test.js test/integration/config-v1.test.js test/integration/guidance.test.js test/integration/whatsnext-guidance.test.js` | 通过；32 项测试全部通过，覆盖接入、配置快照和 guidance |
| `node --test test/contract/ci.test.mjs test/contract/functional-boundaries.test.js test/integration/list-ideas.test.js` | 通过；18 项测试全部通过，覆盖 CI、模块边界及查询测试生命周期 |
| `pnpm pack:check` | 通过；准确打包文件 89 个 |
| `pnpm check` | 通过；完整 7 个 release-grade gate 全部通过 |
| `node bin/silvermoon.js check --worktree --audience agent` | 通过；当前 worktree 候选元数据有效 |
| `pnpm check:commit` | 通过；worktree 测试、契约、烟测、纯度、Markdown、skill、差异及 staged 元数据 gate 全部通过 |
| `git diff --check` | 通过 |
| `git diff --cached --check` | 通过 |
| `git diff --quiet` | 通过；提交前 worktree 与 index 对齐，无未暂存修改 |

完整 `pnpm check` 中各 gate：

- lint:markdown：通过。
- check:pure：通过，144 个标注函数、13 个规则模块。
- check:quick：通过；unit/runtime 共 195 项，191 通过、4 个平台用例按原条件跳过；
  contract 共 39 项全部通过。
- test:integration：通过；152 项，149 通过、3 个真实 Copilot 用例按原条件跳过。
- pack:check：通过，89 个准确文件。
- test:e2e：通过；隔离打包安装烟测成功，包含真实 CLI 和公共／Agent 包子路径。
- check:skills：通过；本地 canonical copy 一致，外部 discovery 成功。

没有把跳过项改成成功执行：本机未运行四个 Windows 原生 TUI 用例和三个
需要真实 Copilot 的集成用例，未在本机验证 Windows 或 Node 24。原 CI 的
Ubuntu/Windows/macOS 与 Node 22/24 matrix 保留；这些外部或平台证据不由本次
本地运行伪造，也不构成部署验收。安装态烟测不等于 npm 发布。

首轮完整检查发现新增包文件和 CI gate 需要更新，以及测试注册的时序问题；
修正后重跑失败项及完整 `pnpm check`，最终没有失败或取消的测试。

## 提交与同步

代码与实施契约候选
[`2d8df5a431f7ca5c56292ea8203a3b58fe6a6888`](https://github.com/shazhou-ww/silvermoon/commit/2d8df5a431f7ca5c56292ea8203a3b58fe6a6888)
已通过普通非强制 push 同步到 primary。刷新 origin/main 后确认该提交可达，
重新观察仍为 implementing，内容语言为 zh-CN，已批准 idealRevision 未改变。

提交前已对齐 worktree 与 index，运行完整 release check、worktree 检查和
`pnpm check:commit`；其 staged gate 验证准确暂存元数据，不将其冒充暂存代码
测试。首轮提交前检查发现两处文件末尾空行，修正格式后重跑提交前及完整
release 检查，全部通过。

本证据收尾与 ledger 完成项只改变 idea 文档，不改变上述已验证的源码、测试、
依赖清单、包文件清单或维护文档。最终准确 implementationRevision 与 primary
提交以这份收尾候选同步后的最新 whats-next 为准；人工验收须针对该准确版本。
没有记录 acceptInner，没有开始 deployment，也没有将 ledger 勾选当成人工决定。
