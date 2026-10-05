# 设备级 daemon 与 Agent 协作集成

## 意图

在已独立交付的事件模型、本地交互协议和真实 Agent 适配能力之上，提供同一个
Silvermoon 包内的设备级 daemon 子命令，完成跨项目持续调度与端到端恢复。
上游沟通者与下游执行者分工，由确定性的 loop harness 维持交互和推进。

本 idea 收敛为最终集成，不再一次性承担全部底层协议改造，也不只是汇总卡。
整体交付目标仍为 `0.4.0`，并集成已完成的 V2 事件持久化基础；前置项完成不各自触发发布，
记录或拆分 idea 不等于批准实施或授权 npm 发布。

## 背景

当前 Agent 同时承担沟通、调度和具体执行，循环行为过度依赖 Agent 的临场
判断。2026-09-30 至 2026-10-01 的讨论确定了角色拆分、设备级 daemon、
项目版本隔离和本地事件驱动的方向；随后将三个可独立验收的基础项拆出。

期望的职责关系是：

```text
人 <-> 上游沟通者 Agent <-> Silvermoon daemon <-> 下游执行者 Agent
                                  |
                         项目版本 Silvermoon
```

上游理解意图并取得人类决策，下游执行工作并求助，项目版本 Silvermoon
判断下一步，设备 daemon 落实持续调度。该协调是上下游执行之间的桥梁，
不是另一套基于 primary 的跨设备任务系统。

## 前置 idea 与责任边界

### 事件化状态与迁移

[event-state-model](../../../../01M3SJTKFRQ19DP0RPPJACKGMC/outer/inner/ideal/Idea.md)
负责 V2 事件事实、revision 绑定、状态归约、受控追加、历史检查和迁移；分段
物理布局由下列已完成的前置项定义。它无需 daemon 即可通过无状态 CLI 独立验收。

### V2 分段事件流

[segmented-event-streams](../../../../01M3Y5QQ2ATPT8XWH3RCPZTHT8/outer/inner/ideal/Idea.md)
已 completed，为 daemon 提供已交付的 V2 存储基础：每条项目事件流是 idea 下的
`events/` 目录；按规范 ordinal 排列 JSONL 段，每段最多 1000 个事件，逻辑序号
跨段连续。事件流 HEAD 是完整 `events/` folder 的规范 Git tree OID，并携带准确
逻辑字节长度；HEAD 随 repository object format 使用 SHA-1 或 SHA-256。
cursor 绑定已处理前缀的 `{ length, digest }`，不以 sequence 代替内容身份。
单事件上限、规范段序及 digest 编码依赖该前置契约；daemon 不自行实现第二套。

schema 仍为 V2。旧单文件 V2 到分段 V2 的一次性转换已由 Silvermoon 仓库内部
迁移完成，不增加本 daemon 的迁移命令或对外迁移支持。治理 Agent session 不建立
event stream；治理输入可靠性由 upstream requestId 重投与 daemon receipt 处理，
而非复制一套治理事件模型。

### 本地交互协议

[local-agent-handoff](../../../../01M3SJXTDXW54FFCSKSBJMMRBZ/outer/inner/ideal/Idea.md)
依赖事件基础，负责运行中追加 `ping`、`pong` 关联、未处理指令以及 Git
阻塞下仍可通信的语义，无需真实 Agent 即可验证。

### 项目运行时与 Copilot 适配

[project-agent-runtime](../../../../01M3SK3CGZF47A36D2GWN8BFPC/outer/inner/ideal/Idea.md)
负责进程隔离协议、项目语义自治及 Copilot CLI 的真实 session 能力。
能力验证可在该项获准后与前两项并行开展，最终验收依赖真实事件与交互协议，
不依赖常驻 daemon。

### 本 idea 的独立责任

全部前置项构成本 idea 的集成前提；其详细契约分别在对应 idea 中维护，本项不
重新实现或复制一套底层模型。验收聚焦真实多项目持续运行、上游消息回路、
运行故障与 daemon 重启恢复，不以“前置项完成”替代集成结果。

建议依赖顺序为事件基础、交互协议、运行时最终对接、daemon 集成；运行时
能力探索可提前。各 idea 的人类批准和验收仍独立，文本依赖不自动记录状态，
也不把其中一项获准视为其他项获准。

## 期望结果

### 一个包中的设备级调度入口

用户从 Silvermoon 的子命令启动长驻 daemon，不需要安装另一套 daemon 产品
或独立命令。现有无状态 CLI 和 `whats-next` 仍可独立使用。命令入口、配置选择、
前台生命周期和退出语义见 [Daemon-CLI.md](./Daemon-CLI.md)。

一台设备由一个 daemon 承载唯一的设备治理 session，并调度本机设备控制项目及
已登记项目中的 idea session。设备控制项目以本机 Git repository 表达设备本身：
其 Ideal World 描述设备目标，Inner World 包含维护脚本和程序，Outer World 是
这台设备上的真实效果。无需每个项目维持治理 session 或常驻 daemon；一个 idea
的指令也不隐式扩展成跨项目复合任务。

daemon 使用前置运行时协议调用各项目独立版本，不要求包版本或 schema
相同、相互兼容或同步升级。协议不支持或运行时不可用时明确报告，
不静默代用全局版本的解释逻辑。

项目版本决定正常流程的下一步、继续或交还；daemon 执行结构化结果，
管理本机调度、会话路由及运行故障，不维护第二套生命周期状态机。
不同项目和工作区不能串线；同一 idea 不因新消息到达就另起并行执行者。

每次 `whats-next` 输出都包含机器可读的 `recipient` 和对应 `instruction`：
`recipient` 明确指出下一步由 `upstream` 还是 `downstream` 处理，daemon 按此
投递指令。daemon 不依赖报告中的 status object，也不从事件日志或自然语言
`nextSteps` 自行推断接收方或重建项目流程。即使同一个 Agent 同时扮演上下游，
recipient 仍是供 daemon 路由使用的显式协议事实。

上下游不直接相互发送协议消息：输入先由对应权威记录，作为当前观察的事实和
上下文；Silvermoon 根据当前观察生成 recipient/instruction，由 daemon 投递。
loop harness 不逐条转发 ping，也不把下游回复原样转发为上游指令；输入与生成的
instruction 不要求一一对应。流程仍需继续时，Silvermoon 可生成后续工作指令，
不要求上游每次另发消息；这不授权重投已发送或执行结果未知的 instruction。
这里的理解与决策归 Silvermoon 的流程/治理规则，不是 daemon 自由解析正文
并猜测项目生命周期。治理范围的具体生成规则仍待细化。

### 设备控制项目、项目上下文与 idea

`$HOME/.silvermoon/device-hq/` 是设备专属的控制项目 repository（设备 HQ）；
`$HOME/.silvermoon/` 是承载该 repository 与非 Git 可变数据的设备级数据根。
设备控制项目具有正常的 Ideal、Implementation、Deployment 和 Silvermoon ideas；
其 Outer World 对应设备真实状态。唯一的设备治理 session 由该项目承载，负责陌生 URL 接入、clone、
设备维护及跨项目协调。治理 session 不按每个管理项目复制。

设备内部 route 采用显式 scope 的 discriminated union：`device` 选择唯一治理
session；`project` 只表达该 session 当前操作的 repository 上下文，不创建另一个
长期 project session；`device-idea` 与 `idea` 分别选择控制项目或 managed project
中的独立 idea worktree/session。设备选择
在外层完成，不在 route 嵌入 daemonId；不使用路径字符串或可选字段组合推断范围。
除设备控制项目外，受管理项目须有 remote URL；设备控制项目以本机设备身份定位。
本机 registry 将规范 projectUrl 映射到首次登记时生成的稳定 projectKey。
projectKey 不由 URL 哈希派生；URL 迁移必须显式协调并保留执行空间和 idea session。
registry 是唯一定位依据，固定根目录不作为目录扫描 fallback。默认布局、交接和
迁移边界见 [Project-storage.md](./Project-storage.md)。

设备控制项目的 idea 与受管理项目的 idea 都有各自正常的 V2 lifecycle events，
并以 project URL 或设备项目身份唯一定位。idea 执行空间使用独立 worktree/session；
控制项目的设备级治理 session 则是唯一且长期存续的 project-level session。

### 唯一治理 session 与消息持久化

设备治理是长期 Agent session，不建立治理 event stream，不将消息镜像进普通项目
Git primary。上下文和对话历史由 Agent SDK 的持久 session 承载；daemon 只持久
保存 session binding、稳定 requestId 的轻量去重/投递回执及恢复所需的运行状态。
上游负责保留未确认输入，并在断线或结果未知时以同一 requestId 重投。治理 session
处理陌生 URL 接入、授权范围内的 clone、Silvermoon onboarding、idea 创建/导航、
设备状态维护及磁盘清理；权限不足或执行结果未知时明确交还上游，不能自行扩大权限。

Agent transcript 提供治理上下文，不替代 idea lifecycle events，也不单独证明
一次输入已处理或脚本已执行。SDK session 的恢复、requestId 去重、投递不确定时的
重观察必须明确；无法证明安全时报告 unknown，不静默新建 session 或盲目重发。
设备控制项目及受管理项目中的 idea 状态仍由各自的 V2 event streams 持久化。详见
[Governance-sessions.md](./Governance-sessions.md)。

### 项目运行时的生产协议

daemon 使用已观察的 authoritative head 直接向目标 idea 的项目版本 Silvermoon
发起 expected-head optimistic append，不在每次正常追加前查询状态，更不调用
`silvermoon event replay`。head 来自初始化观察、追加回执或增量事件；daemon
保存 head 和消费位置是调度元数据，不意味着自行解释项目生命周期。治理 session
的 upstream 输入不通过治理事件 HEAD 校验，而使用稳定 requestId 和 SDK session。

生产协议须提供 expected-head append、读取当前权威 projection/head、从 cursor
读取或订阅增量事件，以及结构化的 appended、stale、idempotent 和 conflict
结果。具体操作名称与编码由实施契约确定，不假定当前前置接口已经具备这些能力。

发往 idea 流的上游输入携带其依据的 expectedHead；对应权威流原子校验并追加。若实际 head
已变化，确认同一提交已记录时可返回幂等结果，否则交还上游重新观察和判断，
不由 daemon 换用新 head 自动重试原输入。daemon 的缓存不是最终权威。
尤其不能将旧 `pong` 自动扩大成对新 `ping` 的回复。

HEAD 标识准确逻辑流内容，不以事件序号替代。项目 idea 流现已由
`segmented-event-streams` 定义为完整 folder digest + 字节长度：摘要覆盖所有
规范命名的 JSONL segment，并使用 repository Git object format；不等于单个段
digest、尾段 digest、repository HEAD 或 idea world revision。sequence 继续用于
事件排序，cursor 的 prefix length/digest 标识已处理的准确前缀。现有 V2 实现将
1000 条作为段上限、1 MiB 作为单事件上限；HEAD digest 是规范 Git tree OID，
包含完整、有序 segment table，而非将整个历史重新拼成单文件 SHA-256。逻辑
session identity 与 event-stream identity 是不同概念；设备治理 session 由 SDK
持久化，不创建单独的治理 stream HEAD。idea stream HEAD 不等于 Git commit，
而是事件 folder 的准确长度与规范 tree digest；不包含未记录的 Agent 活动或
工作区变化。

相同 expectedHead 证明相同日志前态，不单独证明两条输入是重试：同一前态可能
产生不同输入。项目 V2 的幂等检查核对准确前缀和其后完全相同的规范事件记录；
治理输入以稳定 requestId 去重并核对 session delivery receipt。idea stream stale
一律交还上游重新观察和判断；daemon 不换用新 HEAD 自动重试原输入。若治理投递
结果未知，则查询持久 Agent session 和本机 receipt；不能确定时显式返回 unknown。

idea 发送结果不确定时，通过当前 projection/head、增量事件和真实 session 状态
重新观察，不将未知视作未执行。`event replay` 仅用于开发调试、历史验证和受控
人工恢复；Silvermoon 内部直接复用 reducer/projector，不通过 CLI 子进程调用
自己。详细边界见 [Replay-boundary.md](./Replay-boundary.md)。

### 不中断交互的确定性循环

取下一步、执行、重新观察和交还由 Silvermoon 的 harness 组织，不再由下游
Agent 独自决定整个 `whats-next` 循环。每轮按项目版本规则推进，
遇到求助或运行故障明确交还，不以无进展的无限重试代替处理。

上游随时可以追加 `ping`，包括下游运行期间；不得重新引入“先停止并确认”
的轮次限制。按交互协议区分接收、送达、处理和响应，旧结果不吞掉新指令。
`pong` 可以因为 sign-off、无法推进或 Git 提交失败，不要求工作阶段已完成。

交互依据本地 JSONL，不等 commit 或 primary。Git 提交失败后，上游要求
“暂缓提交，先调查 Git”的新指令仍能送达并执行或明确报告阻塞。
正常生命周期限制仍然有效；诊断通道不是越过人类 gate 的后门。

### 上游连接与消息协议

daemon 永远主动向配置的 upstream endpoint 建立 WebSocket 长连接，不开放
入站端口，不提供 serve 模式。生产使用远端 WSS；本地测试由独立 CLI 入口
启动 loopback upstream server，daemon 连接它并使用同一协议。token 直接写在
受保护的用户级 daemon 配置中；唯一配置输入参数是可选的 `--root`，同时隔离
配置、registry、运行状态和设备控制项目。state 路径相对 root 固定，storageRoot
可位于其他分区。

idea 上游路由为 `{ scope: "idea", projectUrl, ideaId }`；设备控制项目内的 idea
`{ scope: "device-idea", ideaId }` 定位；项目操作上下文为
`{ scope: "project", projectUrl }`，治理 session route 为 `{ scope: "device" }`。
URL 是无凭据的规范 HTTPS 仓库身份，不是 worktree 路径或本机 projectKey，
daemon 经 registry 定位 managed project 及执行空间；device route 绑定设备控制
项目中的唯一持久治理 session，不创建 project-specific governance session。
新增 route 及 URL 迁移能力不假定已有 adapter 已支持。

上游 `ping`、daemon 对请求的接收确认、下游适配器的送达观察，以及项目事实中的
`pong` 是不同消息/事实。upstream 保留未确认请求并以相同 requestId 重投；daemon
仅在持久 SDK session handoff 与轻量 receipt 可恢复后确认接收，不能声称 Agent 已
处理或设备操作已完成。`pong` 不与某条 `ping` 建立请求/响应配对。协议须显式处理
重复投递、连接中断和无法确认的结果；不得以旧 `pong` 覆盖新 `ping`，也不得因重连
盲目重复执行。

idea 输入携带上游所依据的准确事件流 HEAD。项目权威流原子校验并追加；如果 HEAD
已变化且不能证明完全相同的事件已经追加，则将 stale 结果交还上游，由上游重新
观察和判断。daemon 不替换成新 HEAD 自动重试原输入，也不因相同旧 HEAD 就把
不同消息当成同一重试。治理输入不携带 event HEAD，以 requestId 去重并观察 SDK
session。idea 正常追加不预先调用查询或 `event replay`。生产恢复通过
当前 projection 与 cursor 增量读取；调试 replay 不成为生产协议。详细边界见
[Replay-boundary.md](./Replay-boundary.md)。

daemon、项目版本 Silvermoon 与下游 Agent 的交互顺序见
[端到端时序图](./Daemon-runtime-sequence.md)。该图用于表达责任边界和
恢复分支；尚未由前置实现提供的 daemon 动作映射及投递恢复事实仍需实施阶段细化。

### 会话连续性与 daemon 恢复

使用前置 Copilot 适配器尽量复用同一路由的下游 session；确认失效并完成在途
执行、未知投递及绑定协调后才允许受控重建，失效本身不授权重复执行。
接收上游请求和交还结果有明确归属，单个项目或 session 故障不应让其他项目
的消息丢失或被误投。

daemon 重启、崩溃或重新连接后，结合本地事件和真实 session 状态恢复调度。
恢复通过项目运行时提供的当前投影、增量事件游标和真实 session 状态完成，
不由 daemon 调用 `event replay` 子命令。恢复不得盲目重新执行副作用，也不能
仅因没有完成事件就再次派发；结果或执行状态无法确认时明确交还，不冒充成功
或确认停止。

完整执行日志仍归下游 Agent，daemon 不采集、存储或管理它。
必要的本机进程、连接和路由信息不能成为另一份权威项目状态。

### 可独立验收的端到端集成

在同一设备上通过一个 daemon 连接多个项目和真实 Copilot session，证明
项目版本独立解释流程、消息按 idea 和工作区正确路由、持续循环能够继续和求助。
同时证明运行中追加指令、Git 阻塞诊断以及 daemon 重启不会丢失待处理指令，
也不会静默重复不确定的执行。

证明既包括正常回路，也包括真实会话故障和恢复场景；不能仅以各前置项
各自通过或 daemon 进程保持运行作为整体已交付的证据。

## 范围

### 范围内

- Silvermoon 包内的设备级 daemon 子命令、持续 loop harness 与消息路由。
- 四个前置能力的集成、多项目及工作区隔离、本机调度边界。
- 设备/项目长期治理 session、独立治理交互流及固定条数分段。
- daemon root 隔离、动态项目登记、稳定 projectKey 与显式 URL 迁移。
- daemon 运行故障和重启恢复，以及与真实 session 状态的协调。
- 端到端协作场景、相应帮助、文档和 skill。
- 以 `0.4.0` 为目标的整体交付准备；真实发布仍遵循独立授权流程。

### 范围外

- 复制前置项的事件模型、迁移、交互协议和 Agent 适配器；集成所需的生产接口
  与治理路由扩展属于范围内，但须明确兼容边界，不宣称前置实现已具备它们。
- 独立 daemon 产品、每项目常驻 daemon 或强制同步项目版本。
- 跨设备锁、中心任务协调服务或独立于 Git primary 的共享事实权威。
- 完整执行日志、全部 Agent 产品适配、聊天 UI 或操作系统服务安装器。
- 严格轮次锁、自动人类决策或把前置 idea 的完成直接当成本项验收。
- 本次拆分工作直接实现 daemon、修改 schema、迁移项目或发布 npm。

## 约束

- 项目版本持有正常流程规则，daemon 只使用结构化调度协议；两者进程隔离。
- 项目事件的校验和追加归项目版本 Silvermoon 的权威生产接口；daemon 不直接
  修改事件流目录。生产路径不调用 `event replay` 子命令；项目版本可通过其
  受支持的 CLI/运行时边界执行追加。Silvermoon 内部复用 reducer/projector，
  不以 CLI 子进程调用自己。
- `event replay` 不属于 daemon 的生产协议；若生产路径需要调用它，先审视缺失的
  是否为当前投影、增量订阅、游标恢复或冲突协调能力。
- `ping` 不是批准，`pong` 不是验收，执行完成也不是人类接受；
  决策仍绑定准确 revision，交互不能绕过既有的人类决策与同步要求。
- 跨设备事实共享、协调与合并仍归 Git primary，本地执行不等于已同步。
- 保留未知修改与并发历史，不依赖 force-push、reset 或广泛 clean 恢复。
- 解析失败、未知事件或不确定执行不得静默跳过、冒充成功或盲目重试。
- 实施契约须明确所依赖的前置能力和证据；前置项变化影响集成时重新观察，
  不静默沿用过期结论。
- 四个前置 idea 已完成不构成本 idea 的批准。治理 Agent session 与轻量
  requestId receipt 不修改或替代项目 idea schema，也不从治理请求或其结果推断
  lifecycle decision。

## 实施时需细化

本机 daemon 发现与启动、上游会话归属、跨项目调度策略、故障隔离和全局恢复
由本项实施契约具体化。`whats-next` 的 `recipient + instruction` 是必须提供的
机器可读 handoff；instruction 如何按状态和交互场景生成，后续逐 case 细化，
不得让 daemon 以解析 status object 或自然语言替代。上游连接传输和连接配置、
remote URL 的规范与本机项目登记方式、认证与凭据来源、请求去重及恢复确认的
持久边界、projection/head 的读取与增量 cursor 协议、stale/idempotent/conflict
协调及不确定发送的重新观察，须结合前置任务的实际实现确定。任何生产路径若
认为需要 replay，须先审视是否缺少投影、游标、消费位置或冲突协调接口。
WSS 出站连接和独立的 loopback upstream server 是
当前设计方向，不预先锁定具体消息编码或接口细节。事件格式与迁移、交互顺序
与确认、运行时协议与 Copilot 实际能力分别在对应前置 idea 中细化，不在本项
重复作出独立定义。

治理操作结果、权限与 registry 控制接口、device governance/idea 交接、idea
分段轮转原子性与 checkpoint/cursor 一致性，以及 governance Agent session 换代
仍需细化。idea 事件归档首期不自动删除；治理 session 换代也不能静默丢失上下文。
未 onboarding 项目的引导方式须明确，不能把治理组件变成所有业务项目的备用
lifecycle interpreter。

一致性复核发现的原路由/SDK session 绑定、上游前态条件、跨流交接、治理调度权威及
共享 Git 操作互斥问题见 [Governance-sessions.md](./Governance-sessions.md)；
这些是进入实施前须收敛的协议问题，不以类型草案或时序占位符代替决策。

## TBD：后续讨论队列

当前已由 `segmented-event-streams` 提供项目流 folder HEAD、长度绑定、1000 条
切段、准确 prefix cursor 和已部署迁移；以下 daemon 特有问题仍待收敛：

- TBD：生成 instruction 的动作身份、观察依据与投递去重。
- TBD：loop 的继续、等待、无新动作及触发条件。
- TBD：唯一治理 session 的 handoff 生成权威与接口，以及 project route 的上下文语义。
- TBD：idea 首次输入的 HEAD 取得方式；治理输入通过 requestId 接入的握手和 ack 阶段。
- TBD：治理操作结果成为后续工作的依据、授权与崩溃续接。
- TBD：共享 Git 操作互斥、session owner 与受控换代。
- TBD：设备控制项目 scaffold 的创建时机、本地 primary branch、版本升级和设备
  身份；自定义 `--root` 下的隔离项目。控制项目从最小本地 Silvermoon scaffold 起步，
  默认不配置 remote、不克隆 Silvermoon 源码，也不跨设备共享设备专属 history。
- TBD：project runtime 如何通过非 replay 生产接口读取已定 prefix/cursor。
- TBD：Agent SDK session 的持久恢复、requestId receipt 与 unknown delivery 衔接。
- TBD：权限边界、协议能力协商与投递观察证据。
