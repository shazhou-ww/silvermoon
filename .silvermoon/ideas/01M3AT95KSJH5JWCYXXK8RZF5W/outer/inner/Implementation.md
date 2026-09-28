# Implementation

## Steps

### I-S01: 建立统一对话报告模型

新增三个公共命令共享的 report builders 和类型约束，以
`intention / observation / outcomes / instructions` 作为唯一内部模型。Observation
按 `project-setup-required / repository-sync-required / task-pending / idle`
判别，项目整备状态再以 `observedThrough` 表达累进字段保证。JSON 直接序列化该
模型；默认模式仅按“意图、观察、动作与结果、下一步”四段渲染，不维护第二套推演。

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

### I-S05: 统一 create-idea 与 check 输出

让 `create-idea` 和 `check` 复用同一 observation 与 envelope。副作用按高层操作
形成 `type / success|failure / summary` outcomes；validation findings、readiness
阻塞及可解释的外部或本地 mutation 失败仍形成可信 envelope 并返回退出码 0。
退出码 1 只保留给无法形成完整 envelope 的内部故障，退出码 2 保留给 CLI 用法
错误。

### I-S06: 迁移 skill 与文档契约

将 repository-local canonical skill registration 迁移到唯一的
`.agents/skills/silvermoon`，同步 packaged skill、安装命令和维护脚本。更新
README、reference、getting-started、adoption、repository task 与 Agent 指引，使
默认调用读取对话文本，`--json` 只作为同一模型的结构化 serialization，并删除
project-local npm dependency 要求和旧 action/report 字段。

### I-S07: 更新测试并完成 release-grade 验证

重写 unit、contract、integration 与 installed-package e2e 覆盖统一 envelope、
四段 renderer、累进 observation、跨生态 adoption、本地优先 hygiene、有界摘要、
裸导航语义、三个命令副作用及退出码。运行 `pnpm check`、skill 同步检查、package
contents、Markdown links 和 `git diff --check`，并将证据记录到 ledger。

## Acceptance criteria

### I-AC01: 三个命令共享一个可对话的输出契约

`whats-next`、`create-idea` 和 `check` 的 JSON 都只含
`intention / observation / outcomes / instructions`；默认文本从同一 envelope
渲染四个语义段落。Unit 与 contract tests 断言 exact shape、无旧
`ok/root/diagnostics/result/action` envelope，并证明默认文本没有独立推演分支。

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

### I-AC05: 副作用和退出码忠实表达本次对话

成功或失败的 fetch 与 scaffold creation 都以有序 outcome summary 表达；部分
创建失败准确说明清理或保留结果。只要完整 envelope 可形成，readiness problems、
invalid checks 和 failure outcomes 均返回 0；内部 envelope failure 返回 1，CLI
usage error 返回 2。Unit、integration 和 e2e tests 同时断言 report 与 exit code。

### I-AC06: Observation 在所有命令中语义一致

三个命令使用同一 state-discriminated Observation：观察 root/version、resolved
configuration、五状态 idea counts、active references 和仅限项目/仓库整备的
problems。Project variants 无 optional/null 占位，字段随 `observedThrough` 累进；
repository、task 和 idle variants 提供更强字段保证。Contract tests 和
TypeScript 辅助契约逐 variant 验证形状。

### I-AC07: 文档、skill、package 与实现一致

canonical packaged skill、`.agents` registration、双语 README、reference、
getting-started、adoption 和 repository instructions 全部使用新推演与输出语义，
不存在 `.github/skills`、project-local npm requirement 或旧 action shape 残留。
`pnpm check`、`pnpm check:skills`、package smoke、Markdown links 和
`git diff --check` 全部通过。
