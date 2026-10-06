# 重构后源码架构对齐

## 已交付的约束

daemon 集成建立在已经交付的三层源码结构之上，不恢复旧 `src/application/`、
宽泛能力桶或同入口 launcher：

```text
bin/                         # 完整进程入口与参数／输出适配
src/business/                # 单一业务入口编排
src/business/shared/         # 至少两个业务入口实际复用的编排
src/foundation/<module>/     # 封闭基础能力、README 和 export-only index
```

依赖只能从应用层向业务层、基础层，或从业务层向基础层。基础模块不回调 business，
业务入口不调用另一个命令实现。新增模块同步提供职责 README、显式 index export、
依赖边界测试和准确 package surface；不得新建 `utils`、万能 context、service
container 或通用 effect framework。

## Daemon 应用与业务入口

`silvermoon daemon` 仍是用户入口。普通短命 CLI 路径不得 eager-load Copilot SDK、
WebSocket 或 daemon state；只有选中 daemon 子命令后才加载对应业务能力。该路径
仍由 `bin/silvermoon.js` 作为完整应用入口完成 argv、配置选择、日志、signal 和
exit code 适配，不另建一份同入口 application launcher。

本地 loopback upstream server 是不同的长寿命进程，因此使用独立 `bin/` 入口；
它不作为 `src/application/` 实现或 daemon 内部模式。

daemon 的可复用流程以函数式 business entries 表达，例如启动、接收上游输入、
推进一个 idea、恢复一个 route 和关闭。每个入口独占文件并接收窄 ports；重复到
至少两个入口的编排才进入 `business/shared/`。长寿命资源可以通过显式 port
管理，但不引入新的 daemon service class 或依赖注入容器。

## HEADQUARTER project runtime

现有 `silvermoon/agents/project-runtime` 的 `ProjectRuntime` 是实验性兼容表面。
当前实现从 managed repository 的 `node_modules/silvermoon` 找 CLI，并以子进程
调用 `whats-next`、`event replay` 和 `event append`；这与 HEADQUARTER 统一
binary/skill 及生产不调用 replay CLI 的契约不一致，不能直接扩展为 daemon 内核。

目标 runtime 使用 HEADQUARTER 当前 release 的业务 use cases，并显式传入已登记
repository/worktree root、snapshot 和 schema facts：

- 下一步调用 `whatsNextUseCase` 等业务入口，不复制 lifecycle 规则；
- 当前 projection/head 与 cursor delta 直接组合 `event-store`、
  `event-cursor`、`event-reducer` 和相关业务函数，不启动 CLI；
- expected-head append 直接调用受控 append 业务边界，不写 `events/` 文件；
- 普通 project 操作使用明确 root，不改变进程 cwd，也不依赖 managed repository
  package manifest 或 `node_modules`；
- schema capability 在开始调度前确定，并随结果显式返回。

`ProjectRuntime` public class 可以保留签名兼容并委托这些函数；其 `replay` 名称仅
作为兼容诊断 API，不成为 daemon 生产调用。普通根 package export 继续不加载
Copilot SDK 或 Agent runtime。

## Registry 与 Agent 兼容表面

现有 `LocalProjectRegistry` 以 project URL hash 作为目录和文件身份，并同时承担
登记、worktree、session binding 与 route lock。目标设计改为稳定随机 projectKey；
因此现有实现只是迁移来源，不是最终持久模型。

新基础模块按变化原因分开：

- `project-registry`：portable projectKey/projectUrl identity 与本机位置绑定；
- `idea-workspace`：primary checkout、idea worktree 与 branch/upstream 验证；
- `agent-session-binding`：route 到 SDK session 的持久绑定；
- `route-lock`：本机 owner lock、验证和受控恢复；
- `daemon-state`：request receipt、消费 cursor 和投递观察；
- `upstream-transport`：认证 WebSocket、重连和 wire framing；
- `daemon-config`：daemon root 内严格配置，不扩张现有用户 `device-config`。

每个模块只暴露原子基础能力；clone/onboarding、URL 迁移、route 恢复和调度属于
business 编排。已有 `LocalProjectRegistry` 与 `CopilotAdapter` public class
保留为兼容 wrapper，或在明确的 public API 变更中迁移，不能让兼容文件继续成为
新增 daemon 状态的聚合位置。

## Schema 与迁移

当前源码只保留面向外部项目的 `bin/migrate-v1-to-v2.js`；本仓库已完成的 internal
events 和 segmented events 迁移入口及实现已删除。daemon 不恢复这些 source-only
工具，也不建立通用 schema migration service。

HEADQUARTER runtime 对登记项目先报告 capability：

- schema v2：通过当前 validation 后可进入 projection、delta、append 和 loop；
- schema v1：保持可识别、可诊断和可读取既有生命周期，但没有 v2 event stream，
  不得推断 event capability 或进入 daemon 交互循环；
- v1 到 v2：只能通过保留的独立迁移入口显式 plan/apply/resume/rollback，绑定准确
  plan digest 和 writer-stopped 事实；成功提交并重新观察后才能调度；
- 更新或损坏 schema：明确不可用，不降级、猜测或静默改写。

这满足永久“可识别、可诊断、可迁移”底线，但不把所有历史 schema 描述为永久
具备最新生产能力。

## 验证影响

实施验收除端到端 daemon 场景外，还须证明：

- 普通 CLI/package root import 不加载 Copilot SDK、WebSocket 或 daemon state；
- daemon 生产路径不启动 managed repo 的 Silvermoon CLI 或 `event replay`；
- 新目录通过三层依赖、无环、README/index、纯度和 package surface 检查；
- 兼容 subpath 的现有行为有回归测试，wrapper 与新内核结果一致；
- v1 项目明确受阻并得到迁移指引，v2 项目使用 HEADQUARTER release 正常推进；
- Windows/npm executable 修复继续有效，不重新手工解析平台命令。
