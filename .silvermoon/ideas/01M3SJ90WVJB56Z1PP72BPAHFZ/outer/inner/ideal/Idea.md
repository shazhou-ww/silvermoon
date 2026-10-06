# 设备级 daemon 与 Agent 协作集成

## 意图

将一台设备、HEADQUARTER（HQ）、Silvermoon daemon 和下游 Agent 组成一个生产
单元。上游表达意图并取得人类决定；HQ 治理设备；daemon 持续连接、路由和调度；
Silvermoon 根据项目事实生成下一步；下游 Agent 执行。

本 idea 的整体交付目标为 `0.4.0`。当前仍是理想契约，不表示 daemon 已实现，
不授权提前实施或 npm 发布。上下游协议须先 review，完整 ideal revision 须再
获得准确的 acceptIdeal。

## 1. 整体架构

```text
人 <-> 上游沟通者 <-> Silvermoon daemon <-> 下游 Agent
                           |
                  HQ Silvermoon runtime
                           |
              device-hq / managed repositories
```

### 职责边界

| 主体 | 职责 | 不承担 |
| --- | --- | --- |
| 上游 | 提交请求、保留未确认输入、处理交还、取得人类决定 | 将接收确认当作执行完成 |
| HQ | 设备管理、binary/skill、下游可用性、repo clone/onboarding、维护与 remote 同步 | 绕过项目生命周期人工 gate |
| daemon | 上游连接、registry 路由、session binding、轻量 receipt、投递与重观察 | 自行解释生命周期或复制项目状态机 |
| HQ runtime | 按目标 repo schema 校验、观察、追加事件并生成 recipient/instruction | 使用 managed repo 自带 Silvermoon binary |
| 下游 Agent | 唯一设备治理 session 或独立 idea session 内执行、报告结果/求助 | 以 transcript 代替项目 facts |

HQ 是设备管理员，在现有 OS 权限下全权治理设备。已认证上游的 repo 接入请求
即授权 clone/onboarding，不要求 allowlist 或额外逐 repo 批准。仍须核验 URL、
目录占用、项目身份、实际权限和结果；不覆盖未知工作。本期不检查或获取 SUDO
权限，长期希望 HQ 检查自身管理员能力。

### 运行时与状态

- 设备统一使用 HQ 提供的 Silvermoon binary 与 canonical skill，不推荐 managed
  repo 各自安装 package/binary/skill。adoption/readiness 必须验证 HQ 来源，不能
  继续要求 `devDependencies.silvermoon`，也不能靠跳过检查实现。
- 持久兼容边界是 repo 声明的 schema，不是 binary version。推荐最新 schema，
  历史正式 schema 保持可识别、可诊断、有确定性迁移路径；完整读写范围显式声明。
  普通 daemon 操作不静默迁移。v1 无 v2 event capability，迁移前不进入 idea loop。
- HQ runtime 直接调用本 release 的业务能力，显式传入 repository/worktree root，
  不改变进程 cwd、不解析 repo 中的 Silvermoon executable、不启动 replay CLI。
  Silvermoon 源码 checkout 的自身运行时保护保持明确。
- 项目配置、contracts 与 lifecycle events 在所属 repo 中保持权威。V2 idea
  使用分段 `events/`，每段最多 1000 条、单事件最多 1 MiB；HEAD/cursor 绑定
  准确逻辑字节长度与规范 folder Git tree OID，遵循 SHA-1/SHA-256 object format。
  sequence、Git commit、world revision 和事件 HEAD 不能互相代用。
- 治理对话由 SDK 持久 session 承载，不建立 device/project governance event
  stream，不将 transcript 或完整执行日志复制进 Git。

### 身份与执行空间

每设备只有一个长期 HQ governance session。`project` route 仅提供它的 repo
上下文；`device-idea` 和 `idea` 各有独立 worktree/session。同一 idea 运行中收到
新输入不另起并行执行者；状态未知不静默替换 session。

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

见 [Downstream-protocol.md](./Downstream-protocol.md)：HQ/idea session、runtime
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
