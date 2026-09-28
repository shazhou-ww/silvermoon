# Implementation

## Steps

### I-S01: 建立统一对话报告模型

为 `whats-next` 和 `create-idea` 建立共享的
`intention / observation / outcomes / instructions` 对话模型，并让 `check`
只复用项目观察与验证逻辑及 `intention / observation` 公共部分，返回独立检查
结果。对话 Observation 按
`project-setup-required / repository-sync-required / task-pending / idle`
判别，项目整备状态以 `observedThrough` 表达累进字段保证；检查结果另有
`project-ready` 和 `check-unavailable`。JSON 直接序列化各自的模型，默认
文本只排版同一次结果，不维护第二套推演。

### I-S02: 重构生态无关的项目整备诊断

删除 package manager、`package.json`、Silvermoon dependency、`node_modules` 和
execution source 对目标项目的约束。项目整备仅诊断 Git root、Silvermoon
configuration schema/semantics，以及 `.agents/skills/silvermoon` 与当前运行实例
随附 canonical skill 的内容一致性；一次返回所有可独立观察的问题和完整有序建议。

### I-S03: 规范仓库整备推演

先检查本地 worktree、HEAD 和 upstream，再访问 configured primary。当前 branch
只要求 upstream 对应 configured repository/branch，不要求本地名称相同。对
conflicted、staged、unstaged 和 untracked changes 返回稳定 counts、有界路径样例
与精确检查命令；fetch 和 ancestry 只记录事实、outcome 与建议，不修改 worktree、
index、branch 或 history。

### I-S04: 规范任务导航与 lifecycle instructions

裸 `whats-next` 始终列出全部 active ideas，并同时提供讨论和调用
`create-idea` 的选择，不因候选数量自动选中。显式 selector 才进入对应 idea 的
preparing、implementing、deploying 或终态 review instructions；completed 与
abandoned ideas 不参与默认导航。Observation 的 idea summary 同时报告五种状态
counts 和最小 active idea references。

### I-S05: 区分 create-idea 对话与 check 验证

让 `create-idea` 复用 `whats-next` 的对话 envelope，按高层 repo 副作用形成
`type / success|failure / summary` outcomes；可解释的 readiness 阻塞、网络或
mutation 失败仍形成可信对话并返回 0，仅内部故障返回 1、CLI 用法错误返回 2。
将 `check` 作为独立 snapshot validator：保留 HEAD、staged、worktree、commit、
remote 目标的互斥与快照语义，不运行仓库同步或 idea 导航；只在项目验证完成的
`project-ready` 返回 0，项目不合格、目标无法验证的 `check-unavailable` 或内部
故障返回 1，用法错误返回 2。remote 定位仅从 HEAD 读取 primary 坐标并 fetch
精确 commit，不让 HEAD 中无关的 skill/idea findings 阻断远端快照验证；不修改
caller 的 worktree、index 或 branch。

### I-S06: 迁移 skill 与文档契约

将 repository-local canonical skill registration 迁移到唯一的
`.agents/skills/silvermoon`，同步 packaged skill、安装命令和维护脚本。更新
README、reference、getting-started、adoption、repository task 与 Agent 指引：
对话命令默认读取轻量 Markdown、空 outcomes 时省略整段，`--json` 保留必填
`outcomes: []`；`check` 文本只显示目标、结论和 problems，文档明确默认 HEAD
不同于 hook 使用的 `--staged`，以及检查退出码与对话退出码的区别。删除
project-local npm dependency 要求和旧 action/report 字段。

### I-S07: 更新测试并完成 release-grade 验证

更新 unit、contract、integration 与 installed-package e2e，覆盖两个对话命令
共享 envelope、独立 check 结果、轻量 Markdown（含观察中的独立小节与空小节
省略）与可选动作段、累进 observation、
跨生态 adoption、本地优先 hygiene、有界摘要、裸导航语义、snapshot 验证、
check-unavailable、remote 定位、三个命令各自的退出码及 CLI 用法错误。运行
`pnpm check`、skill 同步检查、package contents、Markdown links 和
`git diff --check`，并将本 revision 的证据记录到 ledger。

## Acceptance criteria

### I-AC01: 对话命令共享模型，检查器独立

`whats-next`、`create-idea` 的 JSON 仅含
`intention / observation / outcomes / instructions`，`check` 仅含
`intention / observation`；前两者共享对话模型，后者只复用项目观察和验证逻辑，
不出现对话 outcomes/instructions。Unit 与 contract tests 断言各命令 exact
shape、无旧 `ok/root/diagnostics/result/action` envelope，并证明默认文本与
JSON 来自同一次结果而非独立推演。

### I-AC02: 项目整备不依赖目标项目技术栈

非 Node Git repository 无需 `package.json`、package manager、Silvermoon
dependency 或 `node_modules` 即可通过项目整备；缺失 Git、配置不兼容和
`.agents/skills/silvermoon` drift 会形成正确 `observedThrough` variant、全部
problems 与有序 instructions。Unit 与 installed-package e2e fixtures 证明这些
结果以及 canonical skill 内容校验。

### I-AC03: 仓库整备安全、确定且有界

`whats-next` 在任何 remote 访问前报告本地冲突或修改，只接受指向 configured
primary 的 upstream，并正确区分 fetch failure、behind、ahead、diverged 和
aligned。大量 changes 的输出受固定 item/UTF-8 byte budget 限制，同时保留完整
counts、omitted 数和精确 Git 检查命令；integration tests 证明输出上界、顺序和
工作区不被 Silvermoon 修改。

### I-AC04: 任务导航不替用户选择

裸调用在零、一个或多个 active ideas 时都返回相同选择语义：全部 active
candidates 加新 idea 选项；显式 selector 才返回具体 lifecycle instructions，
显式终态 selector 可 review，而终态 ideas 不进入默认 candidates。Integration
tests 覆盖 ULID、alias、无 selector、未知 selector 和全部五种 lifecycle state。

### I-AC05: 副作用和退出码忠实表达各命令结果

两个对话命令将成功或失败的 fetch 与 scaffold creation 以有序 outcome summary
表达；部分创建失败准确说明清理或保留结果。可信对话即使有 readiness problems
或 failure outcomes 也返回 0，内部无法形成可信对话返回 1；`check` 仅在有效
`project-ready` 返回 0，项目不合格、无法验证或内部故障返回 1；三个命令的 CLI
用法错误均返回 2。Unit、integration 和 e2e tests 同时断言结果形状和进程退出码，
尤其证明 invalid check 不会让 hook 放行。

### I-AC06: 对话与检查的 Observation 各有字段保证

两个对话命令使用同一 state-discriminated Observation：观察 root/version、
resolved configuration、五状态 idea counts、active references 和仅限项目/仓库
整备的 problems。`check` 复用项目整备的累进 variant，检查完成时使用
`project-ready` 加空 problems，目标解析、fetch 或 snapshot 读取失败时使用
`check-unavailable` 加非空 problems 及已知 root/version（commit 可为 null）。
Project variants 无 optional/null 占位，字段随 `observedThrough` 累进；对话的
repository、task 和 idle variants 提供更强字段保证。Contract tests 和
TypeScript 辅助契约逐 variant 验证形状，不将检查失败伪装为有效结果。

### I-AC07: 文档、skill、package 与实现一致

canonical packaged skill、`.agents` registration、双语 README、reference、
getting-started、adoption 和 repository instructions 均区分对话导航与独立
`check` validator、HEAD 默认目标与 staged hook 目标、Markdown 文本和 JSON
结构；不存在 `.github/skills`、project-local npm requirement 或旧 action shape
残留。`pnpm check`、`pnpm check:skills`、package smoke、Markdown links 和
`git diff --check` 全部通过。

### I-AC08: 检查器只放行经过验证的目标快照

默认 HEAD、`--staged`、`--worktree`、`--commit` 和 `--remote` 分别验证约定的
精确 snapshot，不运行对话导航或仓库同步；目标解析、配置定位、remote fetch
或 snapshot materialization 失败均以具体 problem fail closed：无法取得目标
快照时为 `check-unavailable`，HEAD 配置可读取但无效时为
`project-setup-required`。不把无法验证当作配置已通过。remote 仅用 HEAD 的
primary 坐标
定位并验证本次 fetch 的 immutable commit，HEAD 中无关的 skill/idea 问题不
阻断它；caller 的 worktree、index 和 branch 不变。Integration 和 e2e tests
以有效、无效、无法验证的候选及无关 HEAD findings 验证结果和退出码。

### I-AC09: 默认文本保持分层轻量 Markdown 对话

`whats-next` 和 `create-idea` 默认按意图、观察、可选动作与结果、下一步顺序
输出 `##` 标题及简洁列表；在 `## Observation` 下，非空 active ideas 和
observed problems 分别使用 `### Active ideas` 与 `### Problems` 标题及各自
列表，空集合对应的小节省略，不将两类事实混入同一列表。没有副作用时省略
整个动作段但 JSON 仍包含 `outcomes: []`，有副作用时逐项呈现。必要的路径、
commit、revision、候选、命令和停止条件在文本中可读；`check` 文本仅显示目标、
结论及 problems，不输出对话动作或下一步。Unit、contract 和 CLI e2e tests
比对相同结果的 JSON 与文本，断言两个观察小节各自存在/省略、空/非空 outcomes
和检查通过/失败情形。
