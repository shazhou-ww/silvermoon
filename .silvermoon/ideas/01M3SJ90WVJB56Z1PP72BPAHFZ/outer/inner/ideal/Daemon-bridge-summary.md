# Silvermoon daemon event bridge：设计要点

## 目标

一个常驻 daemon 连接上游，调用设备上的 Agent，并通过设备 HEADQUARTER 统一提供的
Silvermoon runtime 处理各项目 idea。daemon 是投递与恢复桥梁，不是另一套项目状态机。

```text
上游 ⇄ daemon ⇄ Agent
                 │
       HEADQUARTER Silvermoon
```

## 三个职责

- **daemon**：维护上游连接、路由、session 绑定和轻量 request receipt；投递工作并
  观察结果，不解释项目生命周期。
- **设备治理 session**：每台设备唯一，由 Agent SDK 持久化。它负责设备维护以及
  其他项目的接入、clone、onboarding 和 idea 管理。治理对话不另存为事件流。
- **HEADQUARTER Silvermoon 与 idea Agent**：设备统一 binary 按目标 repository
  声明的 schema 决定 idea 的下一步并写入 lifecycle events；idea Agent 执行生成的
  instruction。canonical skill 同样由 HEADQUARTER 提供。

## 设备与项目

`$HOME/.silvermoon/` 是设备数据根，不整体作为 Git 仓库：

```text
$HOME/.silvermoon/
├── device-hq/       # 本设备专属、无 remote 的 Silvermoon 项目
└── cache/           # 可变数据，不纳入 Git
```

设备控制项目有自己的 Ideal、Implementation、Deployment 和 idea；它的 Outer
World 就是这台设备。需要持续、可审阅或可重复的维护工作，作为普通 idea 实现并
验证。managed project 按规范 project URL 定位；不为每个项目另建长期治理 session。

## 消息与持久化

- **治理请求**携带稳定 `requestId`。上游保留未确认请求并用相同 ID 重投；daemon
  只保存 session binding、去重和投递回执。确认接收不代表操作已完成。
- **idea 输入**携带所依据的准确事件 HEAD，由目标项目的 Silvermoon 运行时原子追加。
  HEAD stale 时交还上游，不换新 HEAD 自动重试，也不因此派发工作。
- 追加成功后，由项目 Silvermoon 决定 `recipient + instruction`；daemon 负责投递。
  发送结果不确定时先重新观察，不盲目重发。
- 治理对话由 Agent SDK session 保存；项目状态由各自的 V2 idea event streams 保存。
  每段最多 1000 条。daemon 不复制治理 transcript，也不通过 `event replay` CLI
  查询生产状态。
- managed repository 不安装自己的 Silvermoon binary 或 skill；跨项目兼容边界是
  显式 schema。新 binary 支持声明范围内的旧 schema 并建议升级最新 schema，但普通
  daemon 操作不静默迁移 repository。

## 不做什么

- 不为治理 session 创建单独 event stream，也不把治理对话写入各项目 Git history。
- 不为每个 managed project 创建治理 session。
- 不让 daemon 自行决定 idea 生命周期、解析自然语言来猜路由，或自动改写 stale 输入。
- 不把设备控制项目仓库本身变成整个 `$HOME/.silvermoon/` 数据目录的版本化边界。

## 仍待收敛

Agent SDK session 与 requestId 的持久幂等/恢复保证、未知投递的核验方式、隔离
`--root` 的测试边界，以及设备维护和脚本执行的授权与结果验证。
