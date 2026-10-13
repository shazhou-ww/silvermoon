# Silvermoon 三个作用域的 Objective Guide 契约

本页是 [Idea](./Idea.md) 的领域契约，建立在
[Objective Guide 核心类型](./objective-guidance.md)之上；不定义实现步骤，不宣称
下列 Guide 已可运行。Level、check 与 problem 名称为拟定的稳定 ID；Manifest
只在 advancement 中引用 Check ID，runtime 按约定发现同名 executable，并将其
返回的 Problem ID 映射到对应 References namespace。判据复用现有
readiness/lifecycle 语义。

## 组合与路由

```text
Device Guide                  # 独立设备观测，通常只形成 advisory
Project Guide                 # 无 Idea selector 时只做项目级导航
Idea Guide
  prerequisite: Project Guide # JSONata: { root, userHome }
```

每个 Guide 的首个本地层都是 `configuration-invalid`，表内每行给出通往下一层的
advancement checks；全部通过后合成唯一 `terminal`，不额外保存 numeric index。
配置检查尚未通过时，不运行依赖该配置的后续 checks；未知、缺失或错误必须
显式诊断，不能伪装成成功。

这里的配置指被测设备、项目或 Idea 的配置：OG Manifest 无效仍是 Loader
错误，subject/language 绑定无效仍是 typed instance creation error，不伪造
业务 observation。必需配置缺失算无效；允许省略的配置沿用既有默认值。

没有 selector 时不创建 Idea instance，也不自动选择唯一活跃 Idea；项目级响应
继续提供活跃 Idea 列表和创建入口。有 selector 时，命令路由先解析 ULID/alias，
再以有效 `ideaId` 创建 instance。显式 selector 找不到时报告 `idea-not-found`，
不静默回退；项目配置与仓库同步诊断仍优先于 selector 错误。

## 设备级：Device Guide

Subject 为 `{ userHome }`；运行入口、环境和平台事实由 checks 自行观测。
设备状态不写进项目 metadata。

| 本地 level ID | 当前语义 | Advancement checks |
| --- | --- | --- |
| `configuration-invalid` | 个人配置未确认有效 | `device-config-valid`：配置可读取、解析且符合 schema；允许缺省的个人配置使用既有默认值 |
| `runtime-unready` | 运行时来源或版本未确认 | `device-runtime-linked`：验证全局路径和版本；本源码仓库必须链接到当前 checkout，嵌入式 host 保留既有 ownership 语义 |
| `skill-unready` | personal discovery 尚不能找到 canonical skill | `device-skill-discoverable`：验证发现路径与目标，不能用复制或项目内 skill 替代 |
| `update-unconfirmed` | 更新状态未知或仍有待处理的更新 | `device-update-current`：按 channel 和缓存时效判定更新状态；registry 失败显式报告未知，更新可用报告建议，host-managed 保留既有语义 |

`terminal` 表示本轮设备整备目标成立。复用 `loadUserConfig`、
`inspectInstallation`、`inspectPersonalSkill` 与 `inspectRuntimeUpdate`。
首失败决定位置，但不得丢弃已有样本中的其他 advisory 或隐式执行修复；配置
不可用不触发依赖它的操作，独立设备事实仍可采样。

Project 不以完整 Device Guide 为 prerequisite。普通 runtime 更新、skill
待修复或 registry 不可用仍是非阻塞 advisory；个人配置错误和项目实际需要的
runtime/schema 能力不足，分别保留既有阻塞规则。Snapshot-only `check` 继续
省略 runtime/skill/update readiness。

## 项目级：Project Guide

Subject 为 `{ root, userHome }`；`root` 是解析后的项目路径。Git、filesystem、
schema 和所需设备能力由 checks 自行观测，不要求 Device terminal。

| 本地 level ID | 当前语义 | Advancement checks |
| --- | --- | --- |
| `configuration-invalid` | 项目配置与共享 metadata 未确认合法 | `project-config-valid`：Silvermoon 配置可读取、解析且符合当前可识别 schema，引用有效；`project-user-config-valid`：保留个人配置诊断；`project-layout-valid`：目录、Idea 身份、alias、metadata/event reduction 与 worlds 结构有效 |
| `project-unprepared` | 配置可解释，但导航所需整备尚未完成 | `project-adopted`：Git root 与项目归属成立；`project-schema-ready`：区分 validity/readiness，报告所需 runtime refresh 或 migration；`project-guidance-valid`：项目持有的三份阶段 guidance 结构有效，缺失正常、存在但非法则阻塞 |
| `repository-unready` | 本地仓库尚不能安全同步或导航 | `repository-worktree-clean`：无冲突或 staged/unstaged/untracked 候选；`repository-head-present`：有 HEAD；`repository-upstream-matches`：非 detached，upstream 对应 configured primary repository/branch，本地 branch 名不限 |
| `primary-unconfirmed` | 与实际 primary 的关系未确认 | `repository-primary-fetched`：普通 fetch 得到准确 primary；`repository-primary-aligned`：检查 ancestry，ahead/behind/diverged 交回普通 Git 同步；`repository-event-history-valid`：v2 事件边界通过 history 验证；`project-primary-guidance-valid`：核对同步后准确 primary snapshot 中的项目 guidance |

`terminal` 表示本轮项目已整备、仓库已同步，可以进行 Idea 导航。配置合法不等于
schema 已到当前写入目标：可识别的历史 schema 可以通过合法性检查，但在
`project-unprepared` 报告 migration-required；不可识别 schema 明确报告无法
验证及 runtime upgrade 条件，不擅自宣称配置内容一定错误。

Guidance 的配置所有者是 Project，所以校验属于 Project；根据选中 Idea 的
阶段取用其中一份，是内容解析，不另建 Idea level。整备目标检查三份项目
guidance，包括未选中阶段；这是相对旧导航仅检查当前阶段的明确行为扩展，须有
专项测试，不把它宣称为行为完全不变。以后支持 Idea 自有 guidance 时，再增加
Idea 所有的检查，当前不预留空层。

复用 `observeSnapshot`、`evaluateLocalReadiness` 和
`assessRepositoryReadinessWith`；保留诊断聚合、优先级、fetch action 记录及并发
保护。项目级 inventory 仍验证整个共享布局，不能为了让 Idea 兜底层可达而放松
已有 metadata 检查。

## Idea 级：Idea Guide

Subject 为 `{ root, userHome, ideaId }`；`ideaId` 必须是已解析的有效 ULID。
Prerequisite JSONata 只投影 `{ root, userHome }`。Silvermoon 当前仍省略
`minimumLevelId`，因此 Project 未 terminal 时不运行本地 checks；核心契约允许
其他 Guide 选择 immediate prerequisite 的中间最低层。以下
`configuration-invalid` 是首个本地层。

| 本地 level ID | 当前语义 | Advancement checks |
| --- | --- | --- |
| `configuration-invalid` | 选中 Idea 的配置与契约结构未确认合法 | `idea-metadata-valid`：所选 metadata/event log、语言配置及引用有效；`idea-contracts-valid`：三个 world 入口与 ledger 结构有效；读取所选对象时重新确认，不用之前的项目样本充当永久保证 |
| `ideal-unsubmitted` | 当前构想尚未提交 | `idea-ideal-submitted`：当前 `idealRevision` 有匹配的 `submitIdeal` |
| `ideal-unaccepted` | 构想已提交，尚未接受 | `idea-ideal-accepted`：同一当前 revision 有明确 `acceptIdeal` |
| `implementation-unsubmitted` | 当前实现尚未提交 | `idea-inner-submitted`：当前 `implementationRevision` 有匹配的 `submitInner` |
| `implementation-unaccepted` | 实现已提交，尚未接受 | `idea-inner-accepted`：同一当前 revision 有明确 `acceptInner` |
| `deployment-unsubmitted` | 当前现实结果尚未提交 | `idea-outer-submitted`：当前 `deploymentRevision` 有匹配的 `submitOuter` |
| `deployment-unaccepted` | 现实结果已提交，尚未接受 | `idea-outer-accepted`：同一当前 revision 有明确 `acceptOuter` |

`terminal` 只对应 `completed`。所有判据针对准确的当前 revision；submission
过期则停在相应 `*-unsubmitted`，已 submit 且未 accept 才进入
`*-unaccepted`。Agent 准备/提交与人工接受是不同成立条件，不能用 ledger 勾选、
文件齐全或 Agent 判断替代。`probe` 不追加 submit/accept。

Checks 消费现有 lifecycle reducer 的事实，并保持 upstream/downstream 与
精确 revision 投影。v1 没有独立 submission 事实，不凭空补事件；兼容适配把
已存在的准确 acceptance 视为该阶段已提交且已接受，未接受时不虚构 submitted
状态，继续保留 v1 review 语义。`abandoned` 保留独立终态和停止行为，不映射为
completed，也不请求新的 acceptance。

## 命令边界与兼容

现有 `[project] → [repository] → [selection, guidance] → [ideal] → [inner] →
[outer]` 映射为：项目/仓库归 Project，selection 归命令路由，项目 guidance
校验归 Project，Idea 接受判据细分为 submit/accept。Device 独立采样，不引入
OR 或 OPS。

`list-ideas` 与 snapshot `check` 继续使用各自已有的 snapshot 判据，不因复用
Guide 知识而执行完整 Project advancement、增加 fetch、要求仓库同步或新增
设备 readiness。Guide References language 与报告 output language 分离；
prerequisite chain 使用一致的 resolved content language，临时 `--language`
不成为 Idea content-language 决定。

核心类型、固定 `system/404`、typed instance creation failures、subject
projection、check executable 与 locale 完整性均以
[核心契约](./objective-guidance.md)为准，不在
本页重复定义。
