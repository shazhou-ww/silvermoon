# Daemon CLI 设计

本文件是 Ideal World 的目标设计，不是已实现的 CLI 或配置 schema。

## 命令入口

daemon 是 Silvermoon 包内的前台长驻命令，不自行安装系统服务：

```sh
node bin/silvermoon.js daemon [--root <path>]
```

以上命令使用本仓库的 source entrypoint。daemon 永远是主动连接 upstream 的
客户端，不提供 `--mode`、`serve` 或监听地址/端口参数，也不开放入站服务。

`--root` 是唯一的 daemon 配置输入参数，选择整套配置与运行状态。upstream URL 只从配置读取，
不提供 endpoint 或其他配置字段的命令行覆盖项。生产连接使用 WSS，本地测试
连接使用同一 WebSocket 应用协议；仅显式的 loopback endpoint 允许 `ws://`，
其他地址必须使用 `wss://`。

CLI 不提供 `replay` 参数，也不在投递前调用 `event replay`；
相关边界见 [Replay-boundary.md](./Replay-boundary.md)。

## 本地 upstream server

本地测试时独立启动一个 upstream server，再让 daemon 连接它。daemon 不负责
启动、停止或管理该服务，服务也不作为 daemon 的第二种运行模式：

本地服务通过独立 CLI 入口启动，不混入现有 Silvermoon CLI，不作为
`silvermoon daemon` 的子命令。独立入口不预先要求独立仓库或独立发布包。

```text
生产：daemon --WSS--> 远端 upstream server
测试：daemon --WS--> loopback upstream server <-- 测试客户端
```

两种 upstream server 对 daemon 提供同一协议，包括认证、任务投递、确认和状态
收发；本地服务不是另一套项目调度器或事件权威。它可以向测试客户端提供
HTTP/SSE 入口，但该入口属于本地服务，不属于 daemon。其启动命令、监听配置
和测试客户端 API 留待实施阶段定义，不在 daemon 配置中嵌套服务管理参数。

## 配置与凭据

### 配置类型与位置

daemon 不归属于某个项目，在任意当前工作目录都应能启动。默认读取运行 daemon
的 OS 用户的 `~/.config/silvermoon` 为 daemon root，读取其 daemon.yaml。
`--root` 指定时只使用该 root 的配置、登记和状态，不与默认 root 叠加，也不按
当前项目查找。没有配置文件或缺少必要字段时明确失败，不自动连接默认服务。

```text
<daemonRoot>/
├── config.yaml              # 默认 root 下既有用户语言配置；不改变其查找规则
├── daemon.yaml              # daemon 配置
├── registry/                # 动态项目、执行空间与 session 绑定
└── state/                   # session binding、requestId 去重和投递回执
```

registry 和 state 的位置固定相对于 root 计算，不配置 stateDirectory。
自定义 root 不重定位既有用户语言配置。root 不等同于某个项目的 `.silvermoon/`。
同一 root 只允许一个 daemon owner；实例互斥必须可恢复且不以未知状态强制夺取。
设备控制项目 Git repository（设备 HQ）默认位于 `$HOME/.silvermoon/device-hq/`，
其 Outer World 是本机设备；`$HOME/.silvermoon/` 本身不是 Git repository。使用
`--root` 时改用该 root 下隔离的 `device-hq/`，绝不访问真实 home 项目。
设备治理 Agent session 由 SDK 持久化，不创建治理事件流；managed project 的
governance 消息也不复制到其 Git primary。

daemon 全局配置与项目配置是独立的配置类型：

- daemon 配置描述设备身份、连接端点、托管根目录和下游适配器，
  由 daemon 校验和解释；动态项目登记单独维护；
- 项目 `.silvermoon/config.yaml` 描述项目自己的 primary、schema 等规则，
  由 HEADQUARTER Silvermoon binary 按其声明的 schema 校验和解释，daemon 不复制
  这些字段或覆盖项目语义；
- 既有用户 `~/.config/silvermoon/config.yaml` 保留语言偏好用途，不在其中加入
  daemon 字段。daemon 配置无效不应影响普通项目 CLI。

### 目标配置结构

```yaml
version: 1
daemonId: worker-mac-01
storageRoot: /Users/worker/Silvermoon
upstream:
  endpoint: wss://coordination.example.com/worker
  token: "<实际 token>"
downstream:
  adapter: copilot
```

字段含义：

- `version` 是 daemon 配置格式版本，不是项目 schema 或网络协议版本。
- `daemonId` 是稳定的 worker 身份，不是认证凭据；生成和注册规则待细化。
- root 下 state 保存项目/idea session binding、requestId 去重和投递观察等本机
  运行元数据，不保存另一份权威项目状态或 Agent 完整执行日志。治理 session 的
  持久化边界见
  [Governance-sessions.md](./Governance-sessions.md)。
- `upstream.endpoint` 是连接服务的 URL；`upstream.token` 直接保存认证 token，
  不再嵌套 `credential` 或增加环境变量引用方式。
- `downstream.adapter` 首期为 `copilot`，通过本机 SDK/session 接入，不要求 URL。
  工具权限策略需单独细化，不能由 upstream 认证成功推断为允许全部工具。
- `storageRoot` 是 repository 和 idea worktree 的默认托管根目录，使用绝对路径。
  配置中不静态列举全部 projects；registry 单独动态维护 URL 到稳定 projectKey、
  本机位置及 session 的绑定，详见 [Project-storage.md](./Project-storage.md)。

registry 是唯一项目定位依据，不扫描 storageRoot 进行目录名 fallback。项目
登记的控制接口和调度授权仍需细化；不得因上游认证成功就允许访问任意项目。
既有登记与位置冲突时明确失败并要求显式协调，不自动搬迁项目、替换 session
或删除 worktree。陌生 URL 的请求交设备治理 session 检查接入条件，而不是隐式 clone；
clone 与 registry 操作仍受授权约束，不能访问任意本机路径。

运行元数据不反写配置。首期启动时一次性读取完整配置，变更通过重启生效，
不提供热更新。Agent SDK governance session 的恢复和 requestId receipt 语义见
[Governance-sessions.md](./Governance-sessions.md)。idea event streams 仍按固定
事件数分段，首期不自动删除旧段；治理对话不复制为事件日志。
单实例占用的恢复和 root/storageRoot 迁移规则留待实施阶段定义。

### 配置选择与本地测试

CLI 只选择 root，不覆盖配置字段，也不合并多个 root 的配置；选定后统一严格校验。
未知字段、重复项目身份、无效 endpoint 或 token 均明确失败，不能静默降级。

本地测试配置沿用同一结构，只替换 upstream 连接：

```yaml
upstream:
  endpoint: ws://127.0.0.1:7310/worker
  token: "<本地测试 token>"
```

上段是完整配置中 `upstream` 的替换片段，不是可独立启动的完整配置。测试应使用
独立 root、`daemonId`、托管根目录和测试项目，避免占用生产会话与消费位置。

本地测试准备 root 下包含本机 endpoint 的完整 daemon.yaml，再选择该 root：

```sh
node bin/silvermoon.js daemon --root /path/to/test-daemon-root
```

token 允许写入用户级 daemon 配置，但不得出现在命令行、URL、日志或错误信息中。
配置不应提交到仓库或通过备份/同步泄露。含 token 的配置目录和文件必须限制为
运行用户访问；Unix 使用目录 `0700`、文件 `0600`，其他平台检查等效访问权限，
不满足保护要求时明确失败。`--root` 指定的测试配置也遵循同样规则。
不输出配置全文，不提供直接传 token/API key 值的命令行参数。
本地服务也执行认证；其面向测试客户端的 API key 由本地服务自身配置，不放在
daemon 配置中。认证和请求授权的具体协议仍需实施阶段明确。

## 生命周期与输出

命令保持前台运行，以便由终端、launchd、systemd 或容器运行时管理。收到
`SIGINT` 或 `SIGTERM` 后停止接收新请求，等待有界的在途持久化操作结束，关闭
连接并退出；超时应报告未确认操作，不能冒充已完成。

运行日志固定输出稳定的 JSON 结构化记录，不提供 `--log-format` 或配置切换项。
日志可以包含项目路由、请求 ID、事件序号和错误类别，但不得包含凭据、消息正文、
Git 参数或 Agent 完整执行日志。上游协议消息不经 stdout 传输，避免与运行日志
混为一体。

退出码约定：

- `0`：正常关闭；
- `1`：配置、运行时或连接等运行失败；
- `2`：CLI 参数无效。

连接暂时中断属于进程内可恢复状态，不应立即退出；配置无效、认证永久拒绝或
endpoint 不安全则失败关闭。重连与恢复使用当前投影、增量游标和真实
session 状态，不调用 `event replay`。

## 刻意不提供

- `start`、`stop`、`restart`、`status`：由操作系统或容器服务管理器负责；
- `--daemonize` 或 PID 文件：避免复制不可靠的跨平台进程管理；
- `--mode`、`serve`、`--listen-host`、`--listen-port`：daemon 只有主动连接模式，
  本地 upstream server 是独立服务；
- `--config`、`--endpoint`、`--log-format` 或其他配置覆盖参数：只提供可选的 `--root`，
  endpoint 由所选配置决定，日志格式固定；
- `replay` 或“从头重放”：不是 daemon 的生产恢复接口；
- 通过 CLI 直接发送 `ping` 或伪造 `pong`：消息经认证的上游协议进入；
- managed repository 自带 Silvermoon binary 或 skill：设备统一使用 HEADQUARTER
  安装的 release，repository 只声明 schema 并保存项目事实；
- 普通 daemon 操作静默升级 schema：历史 schema 保持可识别、可诊断和可迁移，
  完整读写按声明支持范围提供，迁移必须是显式 repository 变更；
- 将 device-hq remote 当作整个 daemon root 的镜像：秘密、session、receipt、
  cursor、cache、checkout 和 worktree 不进入该 Git repository。
