# Daemon CLI 设计

## 命令入口

daemon 是 Silvermoon 包内的前台长驻命令，不自行安装系统服务：

```sh
silvermoon daemon --config <path> [--mode <connect|serve>] [--log-format <text|json>]
```

`--mode connect` 让 daemon 主动连接配置中的 WSS 上游，是设备工作节点的默认模式。
`--mode serve` 启动仅监听 loopback 的 HTTP/SSE 服务，供本地客户端和测试使用。
省略 `--mode` 时读取配置；配置也未指定时使用 `connect`。

实现可提供传输相关的显式覆盖项，例如 `--endpoint`、`--listen-host` 和
`--listen-port`，但互斥模式的参数不能混用。CLI 不提供 `replay` 参数，也不在
投递前调用 `event replay`；相关边界见 [Replay-boundary.md](./Replay-boundary.md)。

## 配置与凭据

配置文件登记本机项目、规范 remote URL、工作区发现方式、上游地址和运行策略。
优先级为 CLI 显式参数高于配置文件，未覆盖的值保留配置结果。启动时一次性校验
完整配置；未知字段、重复项目身份、无效模式或不安全的远程监听均应失败关闭。

凭据值不得写入命令行、URL、配置文件或日志。配置和 CLI 只声明环境变量名称，
例如上游 credential 或本地 API key 的引用；daemon 启动时从受保护环境解析。

## 生命周期与输出

命令保持前台运行，以便由终端、launchd、systemd 或容器运行时管理。收到
`SIGINT` 或 `SIGTERM` 后停止接收新请求，等待有界的在途持久化操作结束，关闭
连接并退出；超时应报告未确认操作，不能冒充已完成。

默认文本日志面向人工运维，`--log-format json` 输出稳定的结构化日志记录。
日志可以包含项目路由、请求 ID、事件序号和错误类别，但不得包含凭据、消息正文、
Git 参数或 Agent 完整执行日志。上游协议消息不经 stdout 传输，避免与运行日志
混为一体。

退出码约定：

- `0`：正常关闭；
- `1`：配置、运行时、监听或连接等运行失败；
- `2`：CLI 参数无效。

连接暂时中断属于进程内可恢复状态，不应立即退出；配置无效、认证永久拒绝或
无法安全绑定监听地址则失败关闭。重连与恢复使用当前投影、增量游标和真实
session 状态，不调用 `event replay`。

## 刻意不提供

- `start`、`stop`、`restart`、`status`：由操作系统或容器服务管理器负责；
- `--daemonize` 或 PID 文件：避免复制不可靠的跨平台进程管理；
- `replay` 或“从头重放”：不是 daemon 的生产恢复接口；
- 通过 CLI 直接发送 `ping` 或伪造 `pong`：消息经认证的上游协议进入；
- 全局 Silvermoon 版本替代项目版本：每个项目仍由自己的运行时解释和追加事件。
