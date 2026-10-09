# 全局运行时与 Schema 演进影响面调研

## 结论

这项变化不是删除一条 `devDependencies.silvermoon` 检查即可完成。当前项目与
Silvermoon 包版本的绑定同时存在于 npm 整备、仓库内 canonical skill、Agent
项目运行时和文档工作流中；这些入口必须一起改为设备或宿主统一运行时，否则仍会
从其他路径恢复项目级固化版本。

项目长期契约应收敛为“逐文件声明 schema，唯一运行时按该 schema 验证，并要求
项目升级到当前目标 schema 集合”。运行时是否最新属于设备事实和非阻塞提示，
例行检查共享 24 小时缓存；schema 是否与当前 runtime 对应则属于 `whats-next`
项目准备事实。历史 schema 必须保持可识别、可验证和可迁移，但不继续作为普通
lifecycle 写入格式；未知未来 schema 不能被旧运行时猜测为有效，并会要求立即刷新
runtime 的最新版本状态。

Coding Agent 所需的 skill 也应是设备或宿主事实，而不是 repository 副本。全局
Silvermoon package 提供 canonical skill，个人级 skill discovery 目录只保留指向
该目录的链接；普通项目不安装、不提交也不校验 Silvermoon skill。

## 已确认的 0.4.0 切换契约

- Silvermoon package 在本次改造完成后升级到 `0.4.0`，并以该 release 作为取消
  项目级 runtime 检查的明确边界。
- 设备或宿主只提供一个 Silvermoon runtime。目标 repository 不声明、不解析、
  不安装也不回退到自己的 Silvermoon runtime。
- Coding Agent 从 `~/.agents/skills/silvermoon` 或
  `~/.copilot/skills/silvermoon` 发现个人级 skill；该入口链接到全局 Silvermoon
  package 的 `skills/silvermoon`，不复制到被管理 repository。
- 全局 runtime 的安装和升级负责创建、校验及修复个人级 skill 链接。项目准备和
  snapshot 检查不再把 `.agents/skills/silvermoon` 作为项目完整性条件。
- 设备整备查询稳定发布通道并缓存成功结果；缓存未满 24 小时时复用，满 24 小时后
  下一次设备整备刷新。失败不能写成成功 freshness，也不能用无时间边界的陈旧结果
  宣称 runtime 已是最新。
- `0.4.0` runtime 持有一份“当前目标 schema 集合”，按 schema family 映射每类
  项目文件的目标版本。这里的“对应”是 manifest 映射，不要求 schema 数字与
  package SemVer 相等。
- `whats-next` 在项目准备层枚举所有 schema-bearing 文件，先按各自声明的 schema
  判断内容是否有效，再判断声明版本是否等于当前目标版本。报告必须一次列出全部
  需要升级的路径、源版本、目标版本和可用 migration。
- 有效但过期的文件进入 `schema-upgrade-required` 项目准备状态，在完成显式迁移前
  不进入 repository synchronization 或 idea routing。无效文件继续报告 schema
  violation；两者不能混为同一种错误，也不能由普通命令静默修改。
- 文件声明的 schema 高于当前 runtime 对该 family 的最高 read capability 时，
  `whats-next` 绕过例行 24 小时缓存并刷新 registry 状态：有新版时报告
  `runtime-upgrade-required`；当前已是 latest 时报告 latest runtime 仍不支持的
  future schema；查询不可用时明确保留“无法确认”，不把文件误判为损坏。

因此 readiness 有两个正交结论：

1. **Schema validity**：文件是否符合自己声明的 immutable schema。历史 schema
   可以在这一层通过，以便安全生成迁移计划。
2. **Current-schema readiness**：文件是否已经位于 `0.4.0` runtime manifest
   指定的目标 schema。任一文件未就绪，`whats-next` 就进入项目升级准备。

## 术语与边界

当前源码中的 `version` 至少表达三种不同概念，后续契约必须分开命名：

| 概念 | 当前表示 | 应有语义 |
| --- | --- | --- |
| Runtime version | `package.json` 的 `0.3.0`、`SILVERMOON_VERSION` | 当前设备或宿主正在运行的 Silvermoon release |
| Project schema version | `.silvermoon/config.yaml` 的 `version: 1\|2` | repository-owned 元数据的读取、写入与迁移契约 |
| Repository snapshot version | report 中的 `ProjectVersion`，值为 `worktree`、`staged`、`commit` 等 | 本次观察的 Git snapshot，不是 Silvermoon 或 schema 版本 |

本文把“向后 migrate”解释为：**最新运行时能够把受支持的历史 schema 确定性迁移
到当前 schema**。现有系统明确拒绝 v2 到 v1 的降级；如果目标其实是把新数据降级
为旧 schema，需要另行批准，因为这与追加式事件和不可丢失的新语义直接冲突。

“项目不固化 Silvermoon”指被管理 repository 不声明或解析自己的 CLI、package，
也不保存 Silvermoon skill。Silvermoon 源码 checkout 为开发未发布运行时而保留
自举入口和 workspace skill；
宿主程序对实验性 JavaScript API 的普通 npm 依赖也属于宿主构建依赖，但不得再
成为被管理项目选择 schema 解释器的依据。

## 现状证据

### 项目版本绑定有三条独立路径

1. [npm adoption](../../../../../../src/foundation/skill-registration/adoption.ts)
   和
   [adoption rules](../../../../../../src/foundation/skill-registration/rules.ts)
   读取根 `package.json`，要求
   `devDependencies.silvermoon === ^<running-version>`，并把不匹配作为
   `project-setup-required` blocker。
2. 同一 adoption 流程逐字比较
   `.agents/skills/silvermoon` 与当前运行包的 canonical skill；npm 项目还被要求
   从 `./node_modules/silvermoon/skills` 注册。即使删除 package 版本检查，这条
   exact-digest 规则仍会把项目绑定到运行时版本。
3. [ProjectRuntime](../../../../../../src/business/agent-project-runtime.ts)
   明确从项目自己的 `node_modules/silvermoon` 启动 CLI，并在缺失时失败。它不使用
   调用方已经运行的统一 Silvermoon。

这三条路径分别由
[npm-project-adoption](../../../../01M3NCEGB770WDDBDXVEHDRJHV/outer/inner/ideal/Idea.md)
和
[project-agent-runtime](../../../../01M3SK3CGZF47A36D2GWN8BFPC/outer/inner/ideal/Idea.md)
固化为既有决策，本 IDEA 需要明确取代其中的“项目版本拥有解释权”部分，而不是让
新旧模型同时存在。

### 已有设备运行时观察，但没有最新版本契约

[installation](../../../../../../src/foundation/installation/installation.ts)
能够粗略区分 global、source checkout 和其他来源，
[observe-device](../../../../../../src/business/shared/observe-device.ts)
也会收集这些事实，但
[observe-snapshot](../../../../../../src/business/shared/observe-snapshot.ts)
只使用其中的用户配置，没有把 runtime 事实投影到报告或决策。仓库中不存在面向
日常 CLI 的 npm `latest` 查询、版本比较、缓存或离线诊断；现有 registry 访问只
服务于发布验证。后续缓存需要持久化稳定通道、查询时间与查询结果，并由普通设备
整备和 future-schema 触发器共享，不能各自维护互相矛盾的 latest 结论。

另外，Windows 全局入口通常是 `.cmd` shim，当前 installation 逻辑只在可执行路径
以 `.js` 结尾时读取其 package version，因此不能直接承担可靠的“当前版本与最新版本”
判断。

### Coding Agent 已支持个人级 skill

[VS Code Agent Skills 文档](https://code.visualstudio.com/docs/copilot/customization/agent-skills)
列出 `~/.copilot/skills` 与 `~/.agents/skills` 个人级目录，并将
`.github/skills` 与 `.agents/skills` 列为 workspace 目录；
[GitHub Copilot 文档](https://docs.github.com/en/copilot/concepts/agents/about-agent-skills)
也说明个人 skill 可放在前述 home 目录并跨项目使用。因此 Coding Agent 不需要
每个项目都保存同一份 Silvermoon skill。

当前 `skills` 安装器已经支持 `--global`；`--copy` 是显式复制选项，省略时默认
通过链接注册。目标安装模型应固定为：

1. 全局 Silvermoon package 的 `skills/silvermoon` 是唯一 canonical source。
2. 个人级 discovery 目录只保存指向该 source 的链接；全局 package 更新后无需
   修改任一项目。Windows 上的 symlink 或 junction 类型、目标更新和发现行为必须
   用隔离 home fixture 验证，不能在失败时静默退化为项目副本。
3. 链接缺失、悬空或指向其他 release 属于设备安装健康问题，由全局安装、升级或
   doctor 流程修复；它不是 `project-setup-required`，也不进入可重复的 snapshot
   校验。
4. Silvermoon 源码 repository 继续通过 `pnpm sync:skills` 注册 checkout 中的
   workspace skill，并使用 `node bin/silvermoon.js`。这个开发例外只影响该
   workspace，不要求其他项目跟随尚未发布的版本。

个人目录是**执行环境本地事实**。本机 VS Code、Copilot CLI 或 daemon 可以直接
发现它；远程 GitHub cloud coding agent 无法继承开发机 home 或全局 npm 安装，
必须在自己的执行环境中单独 provision 同一全局 runtime 与个人级 skill。该
provisioning 仍不应变成 repository 内的 runtime 或 skill 固化。

### Schema 已版本化，但还不是统一演进系统

- [project config parser](../../../../../../src/foundation/project-config/rules.ts)
  只接受 `version: 1|2`，未知字段和未知版本全部阻塞。
- [v1 status parser](../../../../../../src/foundation/idea-model/status.ts)、
  [v2 event codec](../../../../../../src/foundation/event-codec/grammar.ts) 和
  [idea layout](../../../../../../src/business/shared/idea-layout.ts)
  分别手写校验逻辑；发布的
  [JSON Schemas](../../../../../../schema) 主要由 contract tests 验证，并不是
  runtime 的统一 validator source。
- [scaffold plan](../../../../../../src/foundation/scaffold-plan/scaffold-plan.ts)、
  [event history](../../../../../../src/foundation/event-history/history.ts)、
  `check`、`create-idea` 和 `event` 都直接以 `config.version === 1|2` 分支。
- [v1-to-v2 migration](../../../../../../src/business/migrate-v1-to-v2.ts)
  已具备 read-only plan、准确 digest、clean-source gate、事务恢复和语义等价检查，
  但它是一个专用入口，不是可扩展的 schema migration graph。
- `schema/v1` 与 `schema/v2` 同时容纳 project config、idea state、command report、
  domain message、user config 和 trace 等独立版本域。v2 schema 还引用 v1
  definitions；目录号不能被当作一个全局同步递增的“Silvermoon schema version”。
- `ProjectConfiguration` 的公开 report 投影没有 schema version，而
  `ProjectVersion` 实际表示 Git snapshot。这使调用方无法仅凭报告区分 runtime、
  schema 和 snapshot。

公开 JSON Schema 也没有覆盖全部项目契约。world 目录、canonical Markdown 入口、
ledger、guidance 和辅助文件规则由 layout 检查与 skill 共同定义；例如 runtime
目前只要求 ledger 是普通文件，并不校验其 checkbox 语义。因此“项目元数据符合
schema”必须明确包含结构化 schema 与文件布局/内容边界，不能只指现有 JSON 文件。

### 文档目前互相矛盾

[Getting Started](../../../../../../docs/getting-started.md) 和
[canonical skill](../../../../../../skills/silvermoon/SKILL.md)
要求 npm 项目固定 devDependency 并从项目 `node_modules` 注册 skill；
[README](../../../../../../README.md) 还推荐 `npx` 和 lockfile 固定版本。
但 [Technical Reference](../../../../../../docs/reference.md) 已声明项目整备不应
要求 `package.json`、project-local dependency 或 `node_modules`。实现前必须选择
单一契约并同步所有语言版本、skill copy 和测试。

此前的
[daemon-event-bridge 设计](../../../../01M3SJ90WVJB56Z1PP72BPAHFZ/outer/inner/ideal/Idea.md)
已经提出“设备统一 binary 与 canonical skill，repository 以 schema 为持久兼容
边界”。本 IDEA 可复用这项边界，但不依赖建设 daemon。

## 必改影响面

| 区域 | 必要变化 | 关键代码与验证面 |
| --- | --- | --- |
| `0.4.0` release boundary | 将 package、lockfile、CHANGELOG 和发布契约一致升级到 `0.4.0`；该版本开始不再接受项目级 runtime 选择，并声明其 current schema manifest。 | package/lockfile、release preparation/verification、pack contracts、README 与 immutable release notes。 |
| 运行时发现与更新提示 | 以正在执行的 package manifest 作为当前 runtime 身份；查询稳定发布通道并比较 SemVer。设备整备复用未满 24 小时的成功缓存，过期后刷新；高于 read capability 的 schema 强制即时刷新。更新可用和查询失败形成结构化状态，不能改写 project schema validity。 | [installation](../../../../../../src/foundation/installation/installation.ts)、[CLI bootstrap](../../../../../../bin/silvermoon.ts)、report types、Markdown/TUI/JSON renderer；增加 registry、时钟、缓存、强制刷新、超时和离线注入测试。 |
| 项目 adoption | 删除根 manifest 分类、package-manager 推断、Silvermoon dependency section/value 检查、repository skill 检查和相关 remediation。`check` 不再预载 `package.json` 或 `.agents/skills/silvermoon`。有效项目只由 Git、Silvermoon config/schema、metadata layout 和必要 repository identity 决定。 | [adoption](../../../../../../src/foundation/skill-registration/adoption.ts)、[rules](../../../../../../src/foundation/skill-registration/rules.ts)、[check preload](../../../../../../src/business/check-repository.ts)；重写 adoption、snapshot、setup、create/list/check 与 installed-package fixtures。 |
| Canonical skill | 全局安装器把 personal discovery path 链接到全局 package 的 canonical skill，并在安装、升级或 doctor 中验证 resolved target 与内容。普通 repository 不再创建或校验 skill；仅 Silvermoon source checkout 保留 `pnpm sync:skills` 的 workspace 开发特例。 | `inspectSkill`、`REPOSITORY_SKILL_PATH`、安装/升级入口、[skill adoption guide](../../../../../../skills/silvermoon/references/adoption.md)、Windows 隔离 home fixture、skill contract tests 与源码仓库同步检查。 |
| Agent 项目运行时 | `ProjectRuntime` 使用调用方/设备统一 CLI，并显式传入注册项目的 root/worktree；不得读取目标项目 package name、`node_modules` 或在缺失时回退到另一份 CLI。报告协议仍校验 command、idea 和 schema capability。 | [agent-project-runtime](../../../../../../src/business/agent-project-runtime.ts)、[project runtime tests](../../../../../../test/integration/project-runtime.test.ts)、package subpath 文档和真实 Agent 验收。 |
| Project schema registry | 为每个 schema family/version 声明 immutable validator、read capability、storage/layout adapter 与目标 migration，并由 `0.4.0` manifest 指定每类文件的唯一 write target。`whats-next` 累积扫描所有 schema-bearing 文件，不再让业务代码散布 `version === 1|2`。公开 observation 应暴露逐文件 `schemaVersion` 与 upgrade target，snapshot 类型另行命名。 | project config、idea model/event codec、idea layout、scaffold、event history、create/check/event/list/whats-next，以及 [schema contract tests](../../../../../../test/contract/schema-v1.test.ts) 和 [v2 tests](../../../../../../test/contract/schema-v2.test.ts)。 |
| Migration framework | 保留现有 plan/apply/digest/recovery 安全性质，把专用 v1→v2 迁移纳入显式 migration graph；每条边声明源/目标 schema、语义等价证明、是否可写和中断恢复。storage-only 迁移不得伪装成 schema bump。 | [v1-to-v2 migration](../../../../../../src/business/migrate-v1-to-v2.ts)、state transaction、event-history migration boundary、migration runtime/E2E tests。 |
| 其他公开 schema | command report、domain message、trace 和 user config 各自拥有独立 schema family/version 与兼容政策。需要自描述的 payload 必须携带 schema version；发布后 schema 不得被原地改义。 | [command report schema](../../../../../../schema/v1/command-report.schema.json)、[domain message](../../../../../../schema/v1/domain-message.schema.json)、[trace schema](../../../../../../schema/v2/trace-event.schema.json)、user config、package API 与 renderer contracts。 |
| 文档、skill 与发布门禁 | 删除所有要求目标项目固定 Silvermoon package/CLI/skill 的说明，统一全局 runtime 与个人 skill 链接的安装、更新和诊断指令；保留 source checkout 自举例外。发布检查必须证明旧 schema fixture 仍可读、迁移链连续、最新 schema 可写。 | README 中英文版、getting-started、operations、reference、maintaining、canonical skill 及 adoption/events references、CHANGELOG、pack/E2E/release checks。 |

## 推荐的兼容契约

| 输入 | 最新运行时行为 | 旧运行时行为 |
| --- | --- | --- |
| 当前 schema | 完整校验和读写 | 仅在该运行时声明支持时读写 |
| 受支持历史 schema | 按声明版本完整校验并生成迁移计划；`whats-next` 阻止普通 lifecycle 写入并要求升级到当前目标 schema | 按其发布时能力工作 |
| 更高的未知 schema | 不猜测、不写入；立即刷新 latest 状态。有新版时要求升级，已是 latest 时报告该 release 尚不支持，查询不可用时保留无法确认状态 | 至少读取稳定 envelope 中的 schema family/version，触发 runtime freshness 检查，不宣称项目无效 |
| 无声明、损坏或不符合声明的 metadata | 明确失败并定位违反的契约 | 明确失败，不以自动迁移掩盖损坏 |

严格 schema 与向前兼容并不矛盾：`additionalProperties: false` 可以继续用于一个
已声明版本；跨版本兼容由稳定 envelope、版本化 validator 和 migration graph
提供，而不是让旧 validator 接受任意未知字段。

每次 schema 发布至少需要：

- 不可变的 schema artifact 和独立版本标识；runtime package version 通过 manifest
  选择目标 schema 集合，不把 `0.4.0` 直接写成每个 schema 的版本。
- 一份 machine-readable capability/compatibility manifest，说明逐文件 discover、
  validate、target、migrate 与 unsupported 边界。
- 从仍受支持的每个历史版本到当前版本的连续迁移路径；迁移默认只读计划，
  apply 绑定准确输入并可恢复。
- 冻结的历史 fixture、runtime validator 与公开 JSON Schema 一致性测试，以及
  迁移前后业务投影等价证明。

## 需要守住的行为边界

- 更新提示属于 device/runtime advisory。成功的 latest 结果最多缓存 24 小时，
  未过期时设备整备不得重复访问 registry，过期后的下一次整备必须刷新。npm
  registry 不可达时必须明确报告“无法确认最新版本”，但不能把一个有效 project
  snapshot 变成 setup failure，也不能刷新成功结果的 freshness 时间。
- 个人级 skill 的存在、链接目标和内容属于 device/runtime installation health。
  它可以阻止一个 Agent host 宣称自身已正确安装，但不能改变 `check --commit`、
  `--staged`、`--worktree` 或 `--remote` 对同一 repository snapshot 的结论。
- schema 版本不对应当前 manifest 属于 `whats-next` 的 blocking project
  preparation finding；一次报告所有文件，不能修完一个才逐次暴露下一个。低于
  target 的已知 schema 进入 migration；高于最高 read capability 的 schema 强制
  绕过例行缓存刷新 latest 状态。registry 查询失败本身不使项目无效，但 runtime
  无法解释该 schema 的事实仍阻止 lifecycle 写入。
- `check --commit`、`--staged`、`--worktree` 和 `--remote` 的项目判断必须只依赖
  对应 snapshot 与显式 primary。它们应区分“符合声明的历史 schema”和“已达到
  当前目标 schema”；latest 查询不能污染可重复验证结果。
- 普通命令不能静默迁移。迁移不自动提交、推送、批准或接受 lifecycle revision。
- 新 runtime 必须继续读取所有仍受支持的正式 schema；删除 reader 前需要独立的
  生命周期和迁移完成证据，不能随 npm minor release 顺手删除。
- Silvermoon source checkout 继续使用当前 checkout 入口，且不得添加 self
  dependency；其 workspace skill 只服务该 checkout，不覆盖其他项目的已发布
  全局 skill。这是一项开发边界，不是普通项目固化版本的先例。
- remote/cloud Agent 必须在自己的执行环境中完成 runtime 与个人级 skill
  provisioning；不能读取开发机全局安装，也不能以此为理由恢复 repository 副本。
- 宿主若导入实验性 npm API，其 package lock 只约束宿主代码。被管理 repository
  不得因该依赖选择自己的 Silvermoon runtime。

## 后续实现应提供的证明

- 同一最新 runtime 对无 `package.json`、有任意有效 `package.json`、npm
  workspace 和非 Node repository 给出相同的 schema readiness 结论；这些项目均
  不声明 Silvermoon dependency，也不依赖项目 `node_modules`。
- `0.4.0` fixture 证明 package version、current schema manifest、发布产物和
  CHANGELOG 一致；`0.3.x` 项目不会触发项目 runtime 检查，而是按文件进入 schema
  validity 与 upgrade readiness 判断。
- 可控时钟 fixture 证明成功 latest 结果在 24 小时内不重复查询、满 24 小时后的
  下一次设备整备会刷新、失败不伪造 freshness；即使例行缓存未过期，future schema
  也会触发即时刷新。
- 两个不同 schema 版本的项目由同一个 executable 正确读取；Agent
  `ProjectRuntime` 不访问项目安装的 Silvermoon。
- 隔离 home 的 Windows fixture 证明 global skill 安装产生 personal discovery
  link、resolved target 是当前全局 package、package 更新后无需修改项目即可读取
  新 skill；普通项目 fixture 不包含 `.agents/skills/silvermoon`。
- Silvermoon source checkout fixture 仍使用 checkout runtime 与 workspace skill，
  且不会改写个人级已发布 skill；remote/cloud 环境缺少 provisioning 时给出明确的
  执行环境诊断，而不是要求项目提交 skill。
- 当前版本、落后版本、registry 不可达和 source checkout 四类 runtime 情况都
  产生稳定 advisory，且不改变项目命令的成功/失败语义；future schema 触发时还
  分别证明可升级、latest 仍不支持和无法确认三种 blocking 诊断。
- 同一项目混合 current、历史、无效和未知未来 schema 文件时，`whats-next`
  一次返回完整路径级诊断：历史文件产生 schema-upgrade-required，无效文件产生
  schema violation，未知未来版本产生 runtime-upgrade-required。
- 每条 migration 在 clean candidate 上证明 plan digest、中断恢复、重复执行、
  历史事实/世界 revision/事件语义守恒，并通过 worktree、staged 与 primary
  history 检查。
- README、docs、canonical skill、package API 文档和 CLI remediation 不再同时
  宣传全局 runtime 与项目固化 runtime 两套相反模型。
