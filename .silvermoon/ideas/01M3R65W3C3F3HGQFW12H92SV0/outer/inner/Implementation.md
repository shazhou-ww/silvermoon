# Implementation

本契约实现已批准的 Ideal revision
`79b90701a5ec0276877028267dcfaaf96c5570c2`，不修改产品语义、人工决定或其他
idea。基线和比较方法见 [validation-evidence.md](./validation-evidence.md)。
发布本契约和对应 ledger 后才开始改变验证行为。

## Steps

### I-S01: 固化基线与改善目标

对现有 `check:quick` 和 `check` 分别预热一次并测量五次，保留完整样本、
测试数量、子进程及外部 I/O 归属。前者代表现有日常入口；后者代表现有提交前
交付和发布级入口，其门禁耗时说明普通 CI 的本地对应成本。托管矩阵排队和
发布后真实网络验证不冒充本机可比样本，也不触发 npm 发布。

预先固定 sanity 中位数不超过日常基线的 50%（10,315.5 ms），commit 中位数
不超过全量基线的 50%（65,382.5 ms）。同一机器、worktree、Node.js/pnpm、
一次预热和五次样本进行比较；记录主线并发变更、缓存及资源竞争，不选择性
丢弃慢样本。普通 CI 不设置依赖机器绝对速度的预算。

### I-S02: 按真实成本拆分并守恒测试

将 unit 中的真实 Git/CLI、文件系统 trace、终端渲染与纯函数拆开，将 contract
中的真实仓库行为移至 integration。保留全部断言、原有平台 skip 和清理；
`test:unit` 仍包含移出的 runtime 测试，保持现有三平台、Node.js 22/24 矩阵。
sanity 复用纯 unit 和轻量 schema/API contract，以运行时 guard 拒绝测试中真实
子进程和网络。Node 测试 runner 自身的 worker 不属于业务子进程。

### I-S03: 实现场景调度与快照边界

复用现有 runner 的等待、汇总、退出码和耗时诊断；拒绝未知参数、空集合和
错误选择。`check:quick` 保持语法加完整 unit/contract 的兼容含义，单套件入口
继续可用。新增场景矩阵：

| 入口 | 集合与边界 |
| --- | --- |
| `check:sanity` | CLI 语法、纯 unit、schema/API contract；不执行 Git、终端、安装或网络 |
| `check:commit` | sanity、完整本地 contract、Markdown、技能副本一致性、真实 Git/CLI 冒烟、diff 空白、暂存 Silvermoon 快照 |
| 普通 CI | 无条件完整 unit/runtime 矩阵、contract、integration、本地静态及 skill discovery；风险条件追加 package/E2E |
| `check:release`、`check` | 全部原有发布级门禁，无条件包含 package/E2E 和外部 skill discovery；不发布 |
| 发布后 | 保留 `verify-npm-release.mjs` 的 registry、integrity、provenance、README/CDN 验证，不混入本地入口 |

commit 明确打印：测试针对 worktree，`check --staged` 仅验证暂存的 Silvermoon
元数据，不证明暂存代码经过测试；部分暂存时不得声称精确候选通过。此方案不安装
hook，不自动 stage/stash，不承诺隔离快照测试。提交精确候选时由操作者对齐
index/worktree 再运行检查。

`check:skills:local` 只校验本地副本；`check:skills:discover` 调用外部工具；
`check:skills` 保留两者且不得吞掉失败。

### I-S04: 保守升级 CI 与对齐发布

用共享、可测试的风险选择器决定 package/E2E。仅已知不进入包的 idea 元数据
路径可跳过；包内文档、代码、依赖/锁文件、入口、技能、测试/脚本、workflow、
未知路径均升级。使用完整 base/head diff、禁用 rename 折叠以覆盖删除和重命名；
缺失或不可用基线、空差异、未知事件均明确说明并全量运行。提供显式 `--full`
和 workflow_dispatch 全量路径。核心 CI 不按改动筛选。

发布 workflow 保持最小权限、受保护环境、不可变 tag/commit、实际 tarball
身份及安装验证，补齐本地静态检查，不条件跳过发布必需门禁；不修改或执行
实际 npm 发布动作。

### I-S05: 对齐贡献者与 Agent 指令

更新维护、repository tasks、发布说明及 AGENTS 的推荐命令：迭代先 sanity
和定向测试，提交前 commit，交付/发布前 release。保留 `pnpm check` 完整语义
及必要全量验收，不再要求每次编辑都立即跑全量。文档明确部分暂存限制、
外部依赖、风险兜底和无隐式发布。

### I-S06: 验证并发布实现证据

先运行变更相关窄测试，再跑场景入口、性能样本、`pnpm check`、文档链接、
package/E2E、`git diff --check` 及 Silvermoon worktree/staged 校验。
发布证据后刷新 primary、确认可达性和精确 implementation revision；
如主线移动则保留两边历史并重新观察，不写入新的接受状态。

## Acceptance criteria

### I-AC01: 性能目标与边界可复现

证据包含预热和全部五次样本及中位数，达到 I-S01 的两个预先目标。sanity
guard 证明零真实 Git/业务子进程、网络及终端集成；commit 不启动 package/E2E
和外部技能发现。性能数字不替代确定性边界测试。

### I-AC02: 覆盖与平台守恒

原有 237 项测试（unit 91、contract 25、integration 120、E2E 1）的有效断言
保留，新增测试单独说明，迁移名称/归属可核对。原有两个 Windows 符号链接
skip 不扩大，runtime 仍进入原 unit 的三平台双 Node 矩阵。

### I-AC03: 场景与失败行为确定

测试精确集合、兼容入口、未知参数/空集合、启动失败/非零退出、等待所有门禁
并汇总失败。缺失工具不得成功降级，release 始终包含所有原门禁。

### I-AC04: 暂存与工作区不混淆

通过真实 Git 的部分暂存 fixture，证明 commit 入口区分测试候选与元数据
校验候选，保留 index/worktree；明确警告不是精确暂存代码证明，不自动修复。

### I-AC05: 风险升级与发布保障完整

确定性测试覆盖包内容、依赖、锁文件、技能、workflow、脚本、未知路径、
删除/重命名、不可用基线和显式全量；CI 核心集合无条件运行。workflow 契约
继续验证发布权限、tag/commit、tarball 与发布后检查，无任何隐式 npm 发布。

### I-AC06: 指令一致且全量验收通过

贡献者/Agent 文档与真实 scripts、CI、release 一致；相关窄测试、完整
`pnpm check`、Markdown 链接、`git diff --check`、Silvermoon 快照校验通过。
外部失败保留原始诊断并列为 blocker，不伪装成功。

### I-AC07: 普通 Git 发布与决定隔离

本契约先于实现发布；实现、ledger 和证据经普通非强制 Git 到达刷新后的 primary，
报告精确 commit/revision。Idea/status 不变，不推进其他 idea，不请求或记录未获
明确授权的批准、接受或 npm 发布。
