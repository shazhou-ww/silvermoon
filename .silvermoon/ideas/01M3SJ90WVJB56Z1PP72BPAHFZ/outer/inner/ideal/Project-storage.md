# 项目身份、存储与执行空间

本文件记录目标设计，不代表现有 registry 或 adapter 已支持这些能力。
managed project 请求面向有规范 remote URL 的 Git 项目；设备控制项目是本机身份
定位的特殊项目，不要求 remote URL。

## 稳定身份与唯一定位

首次登记项目时生成稳定的本机 `projectKey`，例如 ULID；它不由 URL 的哈希
派生。对外仍使用规范、无凭据的 `projectUrl` 路由，registry 将 URL 绑定到
projectKey，再定位本机 repository、idea worktree 与 session。

```text
projectUrl → registry → projectKey → 本机执行空间及 session 绑定
```

registry 是唯一定位依据。托管根目录只规定默认存放位置，不作为另一种发现
机制；陌生 URL 进入设备治理检查接入条件，不按目录名扫描或 fallback。
尚未接入的项目不能直接进行 idea 派发。登记路径失效、目录已被占用
或已有 worktree 无法确认归属时，显式协调，不复制、覆盖或自动认领。

## 默认托管布局

```text
<daemonRoot>/
├── daemon.yaml                  # 稳定配置，含可位于其他分区的 storageRoot
├── registry/                    # 动态项目登记及执行空间/session 绑定
├── state/                       # requestId 去重、session binding 和投递回执
├── cache/                       # 仅自定义 --root 使用的非 Git 可变数据
└── device-hq/                   # 仅自定义 --root 使用的隔离设备控制项目

<storageRoot>/
└── projects/
    └── <projectKey>/
        ├── repository/          # managed project 的 primary checkout
        └── ideas/
            └── <ideaId>/        # idea 的独立 Git worktree
```

`$HOME/.silvermoon/` 是设备级数据根，不整体作为 Git repository。默认设备控制项目
Git repository 位于 `$HOME/.silvermoon/device-hq/`；可变 cache 等数据可放在
其 sibling 目录且不受 Git 版本化。设备控制项目描述并驱动该设备自身迭代，
Outer World 是设备真实状态；它包含设备自己的 Silvermoon idea contracts 和事件流，
并承载唯一 governance Agent session。指定 daemon `--root` 时，改用该 root 下隔离的
`device-hq/` 与非 Git cache 目录，绝不读取或写入真实 `$HOME/.silvermoon/`。
设备控制项目默认不配置 remote，不与其他设备共享其 Outer World 或 idea history；
初次从最小本地 Silvermoon project scaffold 初始化，不克隆 Silvermoon 源码，后续
维护脚本与工具由其 ideas 增长。本地 primary branch 的选择和版本升级方式仍待定义。

```text
$HOME/.silvermoon/
├── device-hq/       # only this subdirectory is the device-management Git repository
└── cache/           # mutable, non-versioned data
```

设备项目以 daemon 的 device identity 定位，而不是伪造 projectUrl；其 idea route
使用独立 `device-idea` scope。managed project 仍由规范 projectUrl 和本机 projectKey
定位。

daemon root 默认为 `~/.config/silvermoon`，保存 registry、session binding、
requestId 去重和投递回执等最小运行状态；不保存治理消息历史或治理 event stream。
managed project 的治理事实由设备控制项目的持久 Agent session 提供，不复制到各
managed project 的 Git primary。

在 idea worktree 内，项目 Silvermoon 的规范状态目录为
`.silvermoon/ideas/<ideaId>/events/`，下含按规范 ordinal 命名的 JSONL segment，
每段最多 1000 个事件。idea 流 HEAD 是该 `events/` folder 的完整 Git tree digest
及逻辑长度，使用项目 repository object format；cursor 是准确已处理前缀的
length/digest。daemon 经项目版本 Silvermoon 的生产接口读写，不直接改目录。
完成迁移的 schema 仍为 V2，不为分段布局新增 V3。

session 实体由 Agent runtime 管理，daemon registry 只持久记录唯一治理 session
binding 和每个 idea session 的必要绑定。配置保存稳定的根目录设置；动态项目增删
不要求重写 daemon 配置。requestId receipt 是调度可靠性元数据，不取代项目事件权威。

以上是默认托管布局，不授权自动搬迁已有 clone。是否支持任意外部路径登记、
如何接入已有 worktree，以及登记变更的 API 和授权边界仍需细化。

## 单一治理 session 与 idea 执行空间

设备选择属于连接/控制信封层；以下 route 仅在已经选定的 daemon 内解释，
不嵌入 daemonId。权威编码使用显式 `scope` 的 discriminated union：

```ts
type SessionRoute =
  | { scope: "device" }
  | { scope: "project"; projectUrl: string }
  | { scope: "device-idea"; ideaId: string }
  | { scope: "idea"; projectUrl: string; ideaId: string };
```

`device` 是唯一治理 session，不靠空对象或字段缺失推断。`project` 不带 ideaId，
`idea` 必须同时带 projectUrl 和 ideaId；`device-idea` 只带 ideaId，表示设备控制
项目中的 idea。网络输入须
按分支严格校验，拒绝未知 scope、缺失字段和不属于该分支的字段。路径字符串
不作为权威编码；若后续提供展示/输入路径，须另定可逆编码与 URL 校验规则。

- **设备治理 session** 是唯一的长期 governance Agent session，由
  `$HOME/.silvermoon/device-hq/` 设备控制项目承载。它在授权范围内协调 clone 条件、权限诊断、
  onboarding、idea 创建/导航、设备维护及跨项目工作；接入失败时明确交还上游，
  不自动扩大权限。
- **project route** 只给设备治理 session 提供目标 repository 上下文，不创建或绑定
  project-specific 长期 Agent session。尚未 onboarding 的仓库也使用同一 repository，
  不另建 `bootstrap/` 目录；已有 primary 配置时遵循它，不硬编码 `main`。
- **device-idea thread** 按 device identity + ideaId 定位设备控制项目中的 idea；
  **managed idea thread** 按 projectUrl + ideaId 定位外部项目的 idea。已有 worktree/session 时验证并复用；
  无执行空间时才按明确创建流程建立 worktree 和 session。状态未知时不替换，
  运行中追加指令不另起同一路由的并行执行者。

治理 session 依赖 Agent SDK 持久化，不创建治理事件流或治理 HEAD。上游保留未确认
请求并按 requestId 重投，daemon 保存轻量 receipt 和 session binding；详细恢复边界见
[Governance-sessions.md](./Governance-sessions.md)。设备控制项目的 idea 仍依正常
idea lifecycle events 驱动，不把 governance session 伪装成 idea。

route 指定治理 session 或 idea 执行范围，不等同于某条持久事件流；project route
只携带当前操作上下文。陌生 URL 的输入先进入设备治理 session，接入后根据事实、
原意图和授权决定后续动作，不把原消息逐层转发。输入的 requestId、投递回执和
目标 idea 的生命周期事件各自保持明确边界。

## URL 迁移

仓库 remote URL 变化通过显式项目绑定迁移完成，不把陌生 URL 自动识别为旧项目：

1. 暂停该项目的新派发，协调在途请求、追加和投递观察。
2. 核对本机 repository、Git remote 和 Silvermoon 项目配置，并检查新 URL
   是否已绑定到其他项目；冲突时报错，不合并或覆盖登记。
3. 保持 projectKey、repository 和 idea worktree 位置不变，将 URL 绑定更新为
   新 URL；同步协调 idea session、owner lock、cursor、请求身份等相关元数据。
   设备治理 session 不因 managed project URL 变化而重建；projectKey 仅更新本机
   到 checkout 的索引。
4. 验证迁移结果后恢复调度。迁移不创建替代 session，不重发结果未知的指令。

已有实现以 URL 哈希定位登记和 worktree，并由 URL 派生 session 身份；因此
不能仅改一处 URL 字段就声称支持迁移。跨登记与绑定的原子性、崩溃恢复和验证
需在实施契约定义，未知或并发工作必须保留。

旧 URL 请求须得到明确的已迁移或不可用结果，不能静默注册成新项目。是否允许
有期限的旧 URL 别名仍未确定。primary 分支改名是分支/upstream 协调，不是项目
身份迁移，不改变 projectKey。

## 尚待讨论的边界

- 已有 remote URL 但本机尚无 clone：谁授权 clone、使用何种凭据、如何登记。
- 动态登记/停用/移除由什么控制接口执行；上游认证不等于任意项目访问授权。
- 解除登记、结束 session、移除 worktree、删除 repository 必须分别授权；
  登记移除不隐式授权删除文件或未知工作。
- 唯一设备治理 session 与多个 idea session 的并发协调、创建请求去重及交接恢复。
- 未 onboarding 仓库的引导运行时来源，以及 primary 分支选择。
- 外部路径接入、显式迁移事务和旧 URL 请求的保留策略。
- 设备控制项目的本机 primary branch、初始化/版本升级和 device identity 编码。
