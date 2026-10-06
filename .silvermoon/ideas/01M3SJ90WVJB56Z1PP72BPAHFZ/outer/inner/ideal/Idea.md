# 设备级 daemon 与 Agent 协作集成

## 意图

将一台设备、HEADQUARTER（HQ）、Silvermoon daemon 和下游 Agent 组成一个生产
单元。上游表达意图并取得人类决定；Silvermoon daemon 作为设备管理员，以
device-hq 为设备管理工作区，持续连接、路由和组织工作；Silvermoon 根据项目
事实生成下一步；下游 Agent 执行具体操作。

本 idea 的整体交付目标为 `0.4.0`。当前仍是理想契约，不表示 daemon 已实现，
不授权提前实施或 npm 发布。上下游协议须先 review，完整 ideal revision 须再
获得准确的 acceptIdeal。

## 1. 整体架构

```text
人 <-> 上游 Agent <-> Silvermoon daemon <-> 下游 Agent
                           |                   |
                           +---------+---------+
                                     v
                           无状态 Silvermoon CLI
```

横向表示通信链路，上游与下游通过 daemon 交互；向下表示 daemon 与下游 Agent
都可以调用 Silvermoon 的无状态能力。repo 是数据与工作区，不是活跃 actor，
不放在这张交互图中。daemon 可直接调用 CLI 背后的同一组业务函数，下游可通过
CLI/工具调用；这是两种调用方式，不是两套规则或额外 runtime 组件。

```text
每个 repo（包括 device-hq）
├── general session       # 长期日常会话，不绑定 idea
└── idea sessions         # 分别绑定具体 idea
```

### 职责边界

| 主体/能力 | 职责 | 不承担 |
| --- | --- | --- |
| 人 | 表达目标，review 协议与契约，对准确 revision 作出批准/验收等人类决定 | 被请求、Agent 回复或执行完成自动代替决定 |
| 上游 Agent | 理解人的意图，取得明确决定，提交请求、保留未确认输入并处理 daemon 交还 | 直接向下游发送协议消息；将接收确认当作执行完成或自行推断人类决定 |
| Silvermoon daemon | 设备管理员与唯一持续 loop 控制者；接收/观察输入、调用无状态能力、路由与投递、等待和重新推进，管理 registry/session/receipt | 自行复制生命周期规则；绕过人类 gate；将未知投递当作未执行而重发 |
| 下游 Agent | 在目标 repo 的 general/idea session 中自主执行当前 instruction，调用无状态 CLI 查询/校验/受控操作，结构化报告结果、证据或求助 | 独立领取下一轮并控制 loop；与上游直接通信；自行重复追加交互 pong；以 transcript 代替项目 facts |
| 无状态 Silvermoon CLI | 供 daemon 与下游共同调用；按目标 root/schema 校验、观察、受控追加并依据规则返回 recipient/instruction 或诊断 | 维护长连接、Agent session 或持续调度 loop；接收上下游通信；替人作出批准/验收 |

device-hq 和 managed repos 是数据与工作区，不是上述执行主体。device-hq 是
管理员的普通 repo 工作区，以设备为 Outer World；保存设备目标、维护实现、
ideas 和可同步管理信息，不成为管理员、专属 runtime 或特殊 session 类型。

无状态表示 Silvermoon 不在调用之间持有常驻调度上下文，不表示没有读写副作用：
项目 facts 仍在 repo 中持久化，受控操作仍须验证 schema、前态和明确的决定。

### 调用与循环控制

无状态 Silvermoon CLI 不专属于 daemon。daemon 与下游 Agent 都可以查询项目、
校验和执行受控操作，但 daemon 模式的持续推进 loop 只有 daemon 一个控制者。
无状态 Silvermoon 的规则决定下一步与 recipient；daemon 负责接收输入、观察、投递、等待
和重新推进；下游自主完成当前 instruction，不自行领取下一轮任务。

下游可以调用 `whats-next` 理解状态，但查询结果不授权它另起
`whats-next -> 执行 -> whats-next` 循环。若观察到当前指令过时、阻塞或需要改变
方向，向 daemon 报告并交还，由 daemon 重新观察和路由。

`whats-next` 不是消息传输通道。daemon 先接收并记录/观察上下游输入，再使用
Silvermoon 的下一步能力；有新事实才重新推进，不靠不停查询等待消息。
idea 依据项目事件，general session 依据自身 session/request 上下文。

在 daemon 模式下，交互 ping/pong 的追加由 daemon 统一交给 Silvermoon 的受控
接口完成。下游通过结构化回复报告当前 instruction 的结果、证据、阻塞或 unknown，
不自行追加同一 pong 后再返回一次回复，也不新增“这个 ping 已处理”的生命周期
事件。投递确认、执行报告、阶段完成与人类验收保持不同语义。

Silvermoon daemon 是设备管理员，在现有 OS 权限下组织设备管理，通过下游
Agent 执行具体操作。已认证上游的 repo 接入请求即授权 clone/onboarding，不要求
allowlist 或额外逐 repo 批准。仍须核验 URL、目录占用、项目身份、实际权限和结果；
不覆盖未知工作。本期不检查或获取 SUDO 权限，长期希望 daemon 在 device-hq
工作区组织自身管理员能力检查。

### 运行时与状态

- 设备统一安装 Silvermoon binary 与 canonical skill，由 daemon 在 device-hq
  工作区组织安装、版本与可用性管理，通过下游 Agent 执行；binary 不属于 HQ
  repo，不需要 HQ 专属 runtime。
  不推荐 managed repo 各自安装 package/binary/skill。adoption/readiness 必须验证
  设备安装与 skill 来源，不能继续要求 `devDependencies.silvermoon`，也不能靠
  跳过检查实现。
- 持久兼容边界是 repo 声明的 schema，不是 binary version。推荐最新 schema，
  历史正式 schema 保持可识别、可诊断、有确定性迁移路径；完整读写范围显式声明。
  普通 daemon 操作不静默迁移。v1 无 v2 event capability，迁移前不进入 idea loop。
- daemon 使用设备 Silvermoon release 的业务能力，显式传入 repository/worktree root，
  不改变进程 cwd、不解析 repo 中的 Silvermoon executable、不启动 replay CLI。
  下游 CLI/工具使用同一设备版本和规则；诊断 replay 不变成独立生产 loop。
  Silvermoon 源码 checkout 的自身运行时保护保持明确。
- 项目配置、contracts 与 lifecycle events 在所属 repo 中保持权威。V2 idea
  使用分段 `events/`，每段最多 1000 条、单事件最多 1 MiB；HEAD/cursor 绑定
  准确逻辑字节长度与规范 folder Git tree OID，遵循 SHA-1/SHA-256 object format。
  sequence、Git commit、world revision 和事件 HEAD 不能互相代用。
- 每个 repo 的日常对话由 SDK 持久 general session 承载，不建立独立 general
  session lifecycle event stream，不将 transcript 或完整执行日志复制进 Git。

### 身份与执行空间

每个 repo 都有一个长期存续、不绑定 idea 的 general session，以及分别绑定具体
idea 的 sessions。general session 的日常上下文按 repo 隔离，不能集中在 HQ；
常驻表示长期保留绑定与上下文，不要求 Agent 始终运行或持续保持连接。

`project` route 选择目标 repo 的 general session；`device` 选择 device-hq 的
general session，不创建特殊设备会话。`device-idea` 与 `idea` 选择各自 repo
的 idea worktree/session。同一 idea 运行中收到新输入不另起并行执行者；状态
未知不静默替换任何 general/idea session。

device-hq 只是管理员的工作区，其项目目标与 Outer World 描述设备管理工作，
不赋予 repo 或 session 特殊身份。陌生 repo 的 clone/onboarding 由 daemon 在
device-hq 的 general session 中组织、交下游 Agent 执行；就绪后该 repo 的日常
工作进入它自己的 general session，不继续借用 HQ 承载项目上下文。

managed repo 以无凭据规范 projectUrl 接入；registry 绑定首次登记生成的稳定
随机 projectKey，不能由 URL hash 派生。registry 是唯一定位依据，不扫描目录
fallback。URL/位置变更须显式协调登记、workspace、session 与在途请求。

| 位置 | 内容 |
| --- | --- |
| `$HOME/.silvermoon/device-hq/` | HQ Git repo，独立 private remote |
| `$HOME/.silvermoon/cache/` | 可丢弃、非 Git 数据 |
| `<daemonRoot>/daemon.yaml` | daemon 配置；默认 root 为 `~/.config/silvermoon` |
| `<daemonRoot>/registry/`、`state/` | 唯一运行登记、binding、receipt、cursor、lock |
| `<storageRoot>/projects/<projectKey>/repository/` | managed primary checkout |
| `<storageRoot>/projects/<projectKey>/ideas/<ideaId>/` | idea worktree |

`--root` 使用隔离配置、registry/state、`device-hq/` 与 cache，不接触真实 HQ，
不合并默认 root。storageRoot 可位于其他分区。portable projectUrl/projectKey
清单可在 HQ 版本化，本机路径、秘密和运行 binding 不进入该清单。

### 进程与源码结构

用户入口为 `node bin/silvermoon.js daemon [--root <path>]`，前台运行，唯一配置
输入是 root。daemon 只主动连接 upstream，不开放入站服务；本地 loopback
upstream server 为独立 `bin/` 进程入口，不是 daemon mode。

遵循已交付的 `bin/` → `src/business/` → `src/foundation/<module>/` 三层结构。
应用适配 argv、signal、输出和退出码；业务函数编排窄 ports；基础模块具有单一
职责 README 与 export-only index。普通 CLI 和根 package import 不 eager-load
Copilot SDK、WebSocket 或 daemon state。不新建万能 context/service container。

daemon 配置与用户语言配置分离，配置变更通过重启生效。凭据只存于受保护配置，
不进入 argv、URL、日志、trace 或 Git；Unix 目录 `0700`、文件 `0600`，Windows
验证等效访问控制。日志为稳定 JSON，不包含消息正文或完整 Agent 执行日志。
正常关闭退出 `0`，运行失败 `1`，参数错误 `2`；有界 shutdown 不冒充在途已完成。

## 2. 上游协议

见 [Upstream-protocol.md](./Upstream-protocol.md)：连接、route、请求身份、
expectedHead、ack、订阅与上游 handoff。协议字段与状态机仍待准确候选 review；
“上游请求即授权”不取消连接认证和输入校验。

## 3. 下游协议

见 [Downstream-protocol.md](./Downstream-protocol.md)：每 repo 的 general/idea sessions、项目操作
能力、动作投递、回复依据与 unknown。原实验性 Agent API 允许显式调整，
不承诺旧签名或项目自带版本执行行为不变。

## 4. 关键决策点

见 [Key-decisions.md](./Key-decisions.md)：已确定方向、本期范围和待 review 项。
本期只将 HQ 的可移植治理信息同步到 private remote，为未来恢复保留资料；
不实现整机自动恢复、身份接管、跨设备 fencing 或恢复后自动放行生产。

### 验收边界

实施阶段细化稳定验收 ID，至少证明：

- 同一 daemon 和真实下游可处理多个项目，按 route 隔离，运行中输入与 Git 阻塞
  诊断仍可处理；旧结果不覆盖新指令。
- HQ 和 managed repos 使用相同 general/idea session 模型，各 general session
  长期保留自身 repo 上下文且不绑定 idea；接入完成后不将目标 repo 日常请求误投 HQ。
- projection、delta 与 expected-head append 使用准确前态，stale 交还上游，
  不改 HEAD 重试；未确认投递不自动重发。
- 正常 daemon 重启/断线可安全重观察本机 session、receipt 和项目 facts；缺口或
  unknown 明确阻塞，不声称副作用已完成。这不等于整机恢复。
- 新上下游协议、API/声明/package subpaths 一致，非兼容变化明确，SDK 能力有证据。
- HQ candidate 验证、提交并以普通非 force Git 同步；准确 commit 可从刷新后的
  private remote primary 到达。冲突/失败保留候选并报告，不声称已同步。
- HQ remote 不含秘密、Agent session/transcript、receipt、cursor、lock、cache、
  managed checkout 或 worktree；普通 CLI 的行为和加载边界保留。

复用已完成的事件模型、分段存储、本地交互及 Agent runtime 前置能力，不将
它们各自完成当作 daemon 端到端交付。不恢复已删除的内部迁移工具；外部 v1→v2
仍是显式独立迁移。`ping` 不是批准、`pong` 不是验收；管理员身份不绕过准确
revision 与 primary 同步要求。
