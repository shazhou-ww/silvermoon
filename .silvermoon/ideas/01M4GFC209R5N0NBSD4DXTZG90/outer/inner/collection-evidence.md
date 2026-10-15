# Whats-next 语料采集证据

## 2026-10-14 初始场景集

- Source revision: `b771e89e2d5fe34548882c2e537ce7a5ef431f72`
- Source dirty: `false`
- Runtime: checkout 构建并通过 `pnpm setup:dev` 链接的全局 `silvermoon 0.5.0`
- Environment: `node:24-trixie-slim`，隔离 HOME、synthetic local primary 和工作副本
- Command: `scenario-lab/run.ps1`
- Result: 9 个场景、18 份 `en-US`/`zh-CN` 报告，全部 exit code 0
- Cleanup: 临时 Git bundle 已删除；完整 corpus 位于 idea-local ignored `scenario-lab/corpus/`

已采集：

- invalid user config；
- personal skill link missing；
- global runtime 从 PATH 隐藏后的 source-checkout advisory；
- untracked worktree change；
- detached HEAD；
- missing upstream；
- idea selector not found；
- implementing idea 的 accepted Ideal 基线；
- 无 selector 的 navigation。

报告核验证明 Git bundle fixture 保留了真实 world OID：基线输出为 `implementing`，
`idealRevision=797de35423c2` 保持 `accepted`。repository failure 场景分别产生
`worktree-changes`、`detached-head` 和 `primary-upstream-mismatch`，并在下一个场景前
恢复到同一主链 checkpoint。

同一 corpus 已生成 9 页 `review.html`：每页并排展示完整 `en-US`/`zh-CN` 原文，
预载 Agent 对冗余、缺失和缺少提示的初审意见。浏览器验证了分页、逐页表单的
localStorage 持久化和与 source revision 绑定的 JSON 导出文件名。

## 2026-10-15 最新代码重跑

- Source revision: `47b33317bceb23fd4cbed7fad1845481af2b2802`
- Source dirty: `false`
- Runtime: clean checkout 构建并通过 `pnpm setup:dev` 链接的全局 `silvermoon 0.5.0`
- Environment: `node:24-trixie-slim`，隔离 HOME、synthetic local primary 和工作副本
- Command: `scenario-lab/run.ps1`
- Dependency bootstrap: frozen lockfile；当前网络通过显式
  `SCENARIO_NPM_REGISTRY=https://mirrors.tencent.com/npm/` 完成引导
- Result: 9 个场景、18 份 `en-US`/`zh-CN` 报告，全部 exit code 0
- Corpus: idea-local ignored
  `scenario-lab/corpus/2026-10-15T00-59-55.837Z/`

本次 `review.html` 的 9 个 tab 均显示 Objective/check、分支、前一状态、到达动作、
当前状态和后续动作；浏览器验证了四列桌面布局、单列窄屏布局、初审状态和 comment
加载。最新版输出新增两项初审问题：无 selector 的 `whats-next` 直接到达 Project
terminal 而未提示如何选择 idea；不存在的 selector 报告“没有 active idea”，与同一
fixture 中可选中的 implementing idea 矛盾。两项仅记录为待人工 review 的问题，没有
据此推断 review 已完成或修改产品文案。

## 2026-10-15 Device runtime 聚焦重跑

- Source revision: `48704e070ea85dc19cc3c7cb7753b70dc8ee000e`
- Source dirty: `true`，记录尚未提交的 Objective 紧凑渲染候选
- Runtime: 当前隔离 checkout 构建并通过 `pnpm setup:dev` 链接的全局
  `silvermoon 0.5.0`
- Environment: `node:24-trixie-slim`，隔离 HOME、synthetic local primary 和工作副本
- Command:
  `scenario-lab/run.ps1 -Scenario device-runtime-not-discoverable`
- Dependency bootstrap: frozen lockfile；
  `SCENARIO_NPM_REGISTRY=https://mirrors.tencent.com/npm/`
- Result: 1 个场景、2 份 `en-US`/`zh-CN` 报告，全部 exit code 0
- Corpus: idea-local ignored
  `scenario-lab/corpus/2026-10-15T02-19-22.527Z/`

本次候选把 source-checkout advisory 从 runtime、skill、update 三行表格和额外 setup
段收敛为一个 PATH 问题及一个安装或全局链接、修复 PATH、再用 `silvermoon` 重试的
动作。双语报告均不再出现 personal skill、npm channel 或 Device setup required
文案；Objective Reference 正文也改为详情命令，不再默认内联。单页 `review.html`
保留完整状态转换关系和待评审字段。该场景仍为 `pending`，本次重跑不表示人工 review
完成，也未记录 `submitInner`。

## 2026-10-15 Device prerequisite 单方向聚焦重跑

- Source revision: `48704e070ea85dc19cc3c7cb7753b70dc8ee000e`
- Source dirty: `true`，记录尚未提交的 Device -> Project -> Idea prerequisite
  与 Objective 四段式渲染候选
- Runtime: 当前隔离 checkout 构建并通过 `pnpm setup:dev` 链接的全局
  `silvermoon 0.5.0`
- Environment: `node:24-trixie-slim`，隔离 HOME、synthetic local primary 和工作副本
- Command:
  `scenario-lab/run.ps1 -Scenario device-runtime-not-discoverable`
- Dependency bootstrap: frozen lockfile；
  `SCENARIO_NPM_REGISTRY=https://mirrors.tencent.com/npm/`
- Result: 1 个场景、2 份 `en-US`/`zh-CN` 报告，全部 exit code 0
- Corpus: idea-local ignored
  `scenario-lab/corpus/2026-10-15T03-30-35.484Z/`

本次报告保留 target Idea，但把 owner 停在 Device `runtime-unready` 与
`device-runtime-linked`；Project 和 Idea lifecycle 不再同时评估。输出固定为
Current status、Problems、Next action、References，只包含一个 PATH Problem、
恢复动作和重试命令。双语报告对 `implementation-unsubmitted`、`submitInner`、
phase guidance、Device advisory、personal skill 和 npm channel 均为零匹配。单页
`review.html` 保留状态转换和待评审字段；该场景仍为 `pending`，本次重跑不表示人工
review 完成，也未记录 `submitInner`。

## 2026-10-15 Current status 与只读评审页聚焦重跑

- Source revision: `48704e070ea85dc19cc3c7cb7753b70dc8ee000e`
- Source dirty: `true`，记录尚未提交的标题与评审页候选
- Runtime: 当前隔离 checkout 构建并通过 `pnpm setup:dev` 链接的全局
  `silvermoon 0.5.0`
- Environment: `node:24-trixie-slim`，隔离 HOME、synthetic local primary 和工作副本
- Command:
  `scenario-lab/run.ps1 -Scenario device-runtime-not-discoverable`
- Dependency bootstrap: frozen lockfile；
  `SCENARIO_NPM_REGISTRY=https://mirrors.tencent.com/npm/`
- Result: 1 个场景、2 份 `en-US`/`zh-CN` 报告，全部 exit code 0
- Corpus: idea-local ignored
  `scenario-lab/corpus/2026-10-15T03-55-32.817Z/`

双语大标题已改为 `Current status` / `现状`，其余单一 Objective 内容保持不变。
浏览器验证 `review.html` 仅有一个 scenario tab，Agent 初审字段和意见均为只读，
不存在评审 textarea、可编辑 verdict、localStorage 或导入导出入口；维护者反馈改由
聊天承载。该场景仍为 `pending`，本次重跑不表示人工 review 完成，也未记录
`submitInner`。

## 2026-10-15 Objective 语义自洽聚焦重跑

- Source revision: `48704e070ea85dc19cc3c7cb7753b70dc8ee000e`
- Source dirty: `true`，记录尚未提交的可读 Objective、自然语言现状、具名问题事实
  与 output locale 修复候选
- Runtime: 当前隔离 checkout 构建并通过 `pnpm setup:dev` 链接的全局
  `silvermoon 0.5.0`
- Environment: `node:24-trixie-slim`，隔离 HOME、synthetic local primary 和工作副本
- Command:
  `scenario-lab/run.ps1 -Scenario device-runtime-not-discoverable`
- Dependency bootstrap: frozen lockfile；
  `SCENARIO_NPM_REGISTRY=https://mirrors.tencent.com/npm/`
- Result: 1 个场景、2 份 `en-US`/`zh-CN` 报告，全部 exit code 0
- Corpus: idea-local ignored
  `scenario-lab/corpus/2026-10-15T04-32-03.486Z/`

双语报告以 `Device readiness` / `设备整备` 直接命名当前 owner Objective；
Current status / 现状用自然语言说明本次请求要推进 Idea，但必须先完成设备整备。
Problems / 问题只展示 description 与具名的 runtime source、version 观测事实，不再
显示 target、owner、level、failing check 属性列表、Problem ID 或原始参数 JSON。
Next action / 下一步动作不含 `if needed` / “如有需要”。`en-US` 报告对汉字零匹配，
两个 locale 的动作和 Reference command 均使用对应 output language。浏览器验证
`review.html` 仅含该场景的一个 tab，双语新文案和只读 Agent 初审意见均已加载。该
场景保持 `pending`，等待人工复审；本次重跑未记录 `submitInner`。

## 2026-10-15 九场景统一复审 corpus

- Source revision: `e5c954bbc4d080ae200dbac247a5874f6463fea5`
- Source dirty: `false`，clean commit 包含单一 Objective、target 标题、runtime 路径
  事实、locale 修复与只读评审页
- Runtime: 当前隔离 checkout 构建并通过 `pnpm setup:dev` 链接的全局
  `silvermoon 0.5.0`
- Environment: `node:24-trixie-slim`，隔离 HOME、synthetic local primary 和工作副本
- Command: `scenario-lab/run.ps1`
- Dependency bootstrap: frozen lockfile；
  `SCENARIO_NPM_REGISTRY=https://mirrors.tencent.com/npm/`
- Result: 9 个场景、18 份 `en-US`/`zh-CN` 报告，全部 exit code 0
- Corpus: idea-local ignored
  `scenario-lab/corpus/2026-10-15T06-07-00.295Z/`

本次统一重跑已先同步 primary 的 potential-guide core 迁移，再让 9 个 tab 使用同一
source revision 与同一 clean commit。flow 元数据已按当前 prerequisite ownership 更新：
选中 Idea 的 Device、Project、Idea 场景分别显示
`target idea → owner device|project|idea`。Agent 初审也已根据新输出刷新；除第一个
runtime 场景继续保持 `pending` 外，其余场景保留或更新各自的当前初审结论，不代表
人工 review 完成。`en-US` 报告中只有 `selected-idea-current-state` 含中文，其来源是
content language 为 `zh-CN` 的 repository-owned implementing guidance；Silvermoon
拥有的标题、Problem、action 和 References 仍使用 `en-US`。浏览器验证
`review.html` 含 9 个可切换 tab，第一个 tab 展示 target 标题、runtime 路径、
source-checkout 标记、setup 命令和只读 `pending` 状态。本次未记录 `submitInner`。

## 2026-10-15 Target 标题与 runtime 路径聚焦重跑

- Source revision: `417a718d0ae8b3b3e08a03caa799bd76cf11a2fe`
- Source dirty: `true`，记录尚未提交的 target 标题、runtime 路径事实和按来源分流的
  恢复命令
- Runtime: 当前隔离 checkout 构建并通过 `pnpm setup:dev` 链接的全局
  `silvermoon 0.5.0`
- Environment: `node:24-trixie-slim`，隔离 HOME、synthetic local primary 和工作副本
- Command:
  `scenario-lab/run.ps1 -Scenario device-runtime-not-discoverable`
- Dependency bootstrap: frozen lockfile；
  `SCENARIO_NPM_REGISTRY=https://mirrors.tencent.com/npm/`
- Result: 1 个场景、2 份 `en-US`/`zh-CN` 报告，全部 exit code 0
- Corpus: idea-local ignored
  `scenario-lab/corpus/2026-10-15T05-14-08.172Z/`

标题按请求的 target Objective 显示为 `Idea progress` / `Idea 推进`，Current status /
现状仍明确说明当前由 Device readiness / 设备整备 prerequisite 阻塞。Problem 将当前
runtime 入口 `/checkout/dist/bin/silvermoon.js`、`source checkout` 标记和版本
`0.5.0` 合并为一个事实，不再显示抽象的 runtime source 字段。Next action 根据
source checkout 给出可复制的
`pnpm --dir "/checkout/" setup:dev`，并要求确认 npm global bin 已加入 `PATH`；
非 source-checkout 的同一 Problem 使用明确的
`npm install --global silvermoon` 安装命令。浏览器验证 `review.html` 只有一个
scenario tab，双语 target 标题、runtime 路径事实、setup 命令和只读初审状态均已
加载。该场景保持 `pending`，等待人工复审；本次重跑未记录 `submitInner`。

## 2026-10-15 Reference 驱动的 runtime 动作聚焦重跑

- Source revision: `eb35a5f42ae6415168e64f38926e99a56a0f0110`
- Source dirty: `false`
- Runtime: 当前隔离 checkout 构建并通过 `pnpm setup:dev` 链接的全局
  `silvermoon 0.5.0`
- Environment: `node:24-trixie-slim`，隔离 HOME、synthetic local primary 和工作副本
- Command:
  `scenario-lab/run.ps1 -Scenario device-runtime-not-discoverable`
- Dependency bootstrap: frozen lockfile；
  `SCENARIO_NPM_REGISTRY=https://mirrors.tencent.com/npm/`
- Result: 1 个场景、2 份 `en-US`/`zh-CN` 报告，全部 exit code 0
- Corpus: idea-local ignored
  `scenario-lab/corpus/2026-10-15T06-47-31.454Z/`

`device-runtime` 保持一个 Problem。其 Reference page 的 `description` 说明 PATH
问题，`instruction` 同时给出两条判断规则：facts 标记 source checkout 时在显示的
checkout 路径运行 `pnpm setup:dev`，其他情况运行
`npm install --global silvermoon`。业务 adapter 不再覆盖该 instruction，只统一追加
重试命令；具体分支由 Agent 根据同一 Problem 的 runtime 路径、来源和版本 facts
选择。双语输出与同一 Reference page 一致，场景继续保持 `pending`，等待人工复审；
本次重跑未记录 `submitInner`。

## 2026-10-15 自闭环、目标优先的完整 clean corpus

- Source revision: `ea7e1fe1679aa92d667663ccc6240a48024753fb`
- Source dirty: `false`
- Runtime: 当前隔离 checkout 构建并通过 `pnpm setup:dev` 链接的全局
  `silvermoon 0.5.0`
- Environment: `node:24-trixie-slim`，隔离 HOME、synthetic local primary 和工作副本
- Command: `scenario-lab/run.ps1`
- Dependency bootstrap: frozen lockfile；
  `SCENARIO_NPM_REGISTRY=https://mirrors.tencent.com/npm/`
- Result: 9 个场景、18 份 `en-US`/`zh-CN` 报告，全部 exit code 0
- Corpus: idea-local ignored
  `scenario-lab/corpus/2026-10-15T07-48-15.224Z/`

所有场景保持单一当前 Objective。Problem 默认输出将 locale-neutral structured facts
组织成自闭环自然句，不再显示 `problemTypes`、raw branch JSON 或通用
`key: value` properties。Next action 先说明需要达到的目标状态，再列出可根据实际
facts 选择的方法和复查方式。bare Project terminal 现在说明如何选择下一 Idea；
selector 未匹配时显示真实 active candidates。完整 release validation
`pnpm check` 和 `silvermoon check --worktree --audience agent` 均通过；企业 npm
proxy 缺少 `@potential-guide/objective-guide` 时，仅在 validation 进程中使用
session-local scoped registry 配置，完成后已删除，repository 未写入 registry
设置。`reviews.json` 的 9 个场景全部保持 `pending`，等待人工 review；未记录
`submitInner`，也未请求 `acceptInner`。

## 2026-10-15 第一页反馈修正聚焦重跑

- Source revision: `7908aed7f81b94fb4f6c0dc70b00fb4b5944dd49`
- Source dirty: `true`，记录尚未提交的第一页反馈修正候选
- Runtime: 当前隔离 checkout 构建并通过 `pnpm setup:dev` 链接的全局
  `silvermoon 0.5.0`
- Environment: `node:24-trixie-slim`，隔离 HOME、synthetic local primary 和工作副本
- Command:
  `scenario-lab/run.ps1 -Scenario device-runtime-not-discoverable`
- Dependency bootstrap: frozen lockfile，官方 npm registry
- Result: 1 个场景、2 份 `en-US`/`zh-CN` 报告，全部 exit code 0
- Corpus: idea-local ignored
  `scenario-lab/corpus/2026-10-15T08-35-09.967Z/`

维护者指出 `revision worktree` 不能表达其含义，并质疑 Problem Reference instruction
之后额外出现的精确 `whats-next` 复查命令来自运行时注入。进一步讨论确认
`whats-next` 的 Objective guide 只 probe 当下现实，不提供 snapshot 选择；候选输出
因此从观测上下文移除恒定的 `worktree` / version，只保留根目录与 primary。Objective
下一步仅保留 Problem Reference instruction，不再追加独立复查 action。场景保持
`pending`，等待维护者复审；未记录 `submitInner`。

维护者随后确认单一 Problem 不需要列表编号。表现层改为一个 Problem 直接显示正文，
两个及以上 Problems 才保留有序列表；Objective 的有序数据与优先级不变。第一页
`device-runtime-not-discoverable` 已由维护者确认通过，`reviews.json` 记录为 `ok`，
冗余、内容缺失和提示缺失均为 `no`。

## 2026-10-15 第一页通过后的完整重跑

- Source revision: `7908aed7f81b94fb4f6c0dc70b00fb4b5944dd49`
- Source dirty: `true`，记录持续评审中的候选修正
- Command: `scenario-lab/run.ps1`
- Result: 9 个场景、18 份 `en-US`/`zh-CN` 报告，全部 exit code 0
- Corpus: idea-local ignored
  `scenario-lab/corpus/2026-10-15T09-03-33.233Z/`

自动断言和浏览器验证确认第一页的单一 Problem 没有编号，评审结论显示 `OK`；
完整文档包含 9 页，并已切换到第二页 `device-skill-not-discoverable` 继续评审。

## 第二、三页累计反馈候选

维护者确认 personal skill 未发现与内容 revision 不一致是同一个 `device-skill`
Problem 的两个现实分支。候选渲染不再先重复静态的“未发现或不一致”：missing
直接陈述未发现，incorrect 直接陈述已发现但 revision 不一致。两个分支共用同一
下一步，使用 facts 中由 active runtime 包位置解析出的 canonical skill 路径运行
`npx skills add "<canonical-skill-path>" --global --all`。本轮按维护者要求只修改
候选和测试，等待积累更多页面反馈后统一重采集。

## 2026-10-15 Device 分支完整重跑

- Source revision: `879b0c1945c79f86892c012c47e04126c4279b6e`
- Source dirty: `true`，记录持续评审中的候选修正
- Command: `scenario-lab/run.ps1`
- Result: 17 个场景、34 份 `en-US`/`zh-CN` 报告，全部 exit code 0
- Corpus: idea-local ignored
  `scenario-lab/corpus/2026-10-15T11-30-11.431Z/`

Device 配置场景现在分别覆盖历史版本、registry 已证明可升级的未来版本、错误版本号
和当前版本格式错误。未来版本会查询 active npm registry：有新版 CLI 时提示升级，
确认当前已最新时使用独立 Problem 判定配置版本号错误，freshness 不可用时显式要求
恢复检查。完整个人配置 YAML contract 位于独立
`device/pages/user-configuration` Reference page，不在主报告展开。

维护者最终确认 personal config 需要四个不同 Problem：历史版本、registry 已证明有
新版 CLI 支持的过新版本、版本号本身错误，以及已知当前版本但内容不符合 schema。
其中 registry 确认当前 CLI 已最新时，更高版本号归入
`device-configuration-invalid-version`，文案明确“不是等待更新”，并要求参考当前
config Reference 修复；只有 registry 报告更新可用时才使用 future-version Problem。

维护者进一步统一所有页面的下一步动作结构：先声明 Objective 要达到的目标状态，再
给出适用的修改建议、命令与复查方式。逐页审计确认既有 runtime、repository、routing
和 lifecycle 动作已符合该结构；本轮把 personal skill、canonical skill、配置历史
版本、未来版本、错误版本号和格式错误的三套双语 Problem References 全部改为
goal-first，并在场景 transition 摘要和 review 记录中同步该结构。

项目准备页 review 进一步确认“现状”之后紧接“问题”，因此
“下方问题阻止继续”的版面位置提示没有信息增量。Objective 现状摘要现在只说明请求
目标及当前 prerequisite owner；具体阻塞由紧随其后的 Problem 自闭环说明。

Repository Problem 同样不再输出“下方观测”位置提示。纯 Git 恢复动作只声明目标状态
与 Silvermoon 特有约束（保留未知工作、匹配 configured primary、禁止 force 或历史
改写），不再讲解通用 Git 操作，也不拼接本次 `silvermoon whats-next` 重试命令。

Project coverage 新增三条真实场景：`.silvermoon/` metadata 目录缺失、
`.silvermoon/config.yaml` 缺失，以及 config YAML 无效。Project config 尚未建立时
不再评估依赖其版本的 Idea schemas，避免把一个 config 根因级联成几十条错误 schema
诊断；重复的等价 Problem 与 Reference 在 Markdown 投影中合并。

Personal skill missing 与内容 revision 不一致直接陈述各自现实，并从 active runtime
解析出的 canonical skill 路径生成可复制的
`npx skills add "<实际路径>" --global --all`。canonical skill 本体无法验证使用独立
`device-canonical-skill` Problem，要求先修复或重装 runtime，不错误建议从损坏 source
安装 personal skill。

维护者进一步明确 canonical skill 无法验证时的恢复顺序：Agent 先排查 active
executable、package root、canonical skill 路径和具体读取错误；磁盘或权限异常先修复，
否则建议 `npm install --global silvermoon@latest` 重装最新版 CLI。只有 canonical
skill 可读取并能计算 expected revision 后，才处理 personal registration。本轮只更新
Reference 候选和测试，等待后续反馈统一重采集。

Device coverage 审计还发现 `device-update-current` 的 failure 在当前 `whats-next` 路由
中没有独立可达页面：需要 freshness 的未来 Project schema 会先被 snapshot
preparation 截获并返回 Project schema diagnostics。实验构造确认了这一点，因此没有
把重复的 60 条 schema diagnostics 伪装成 Device 场景；该 check 的可达性作为后续
设计问题保留。

## 2026-10-15 personal skill 内容 revision 校验

- `node --test test/runtime/device-readiness.test.ts
  test/unit/personal-skill-link.test.ts test/unit/whats-next-model.test.ts
  test/contract/dialogue-output.test.ts`：43/43 通过
- `pnpm check:sanity`：通过
- `silvermoon check --worktree --audience agent`：通过
- `pnpm test:contract:built`：64/64 通过
- `pnpm check`：typecheck、build、markdown、pure、skills 和 integration 全部通过；
  Windows native TUI / installed-package 路径复现退出码 `3221225477`，另有既存并发顺序
  用例实际顺序 `second, first` 与固定期望 `first, second` 不同

Docker 聚焦采集命令为
`scenario-lab/run.ps1 -Scenario
device-skill-not-discoverable,device-skill-content-mismatched`。首次运行因 synthetic
primary 目录不可写失败；恢复到容器用户 HOME 后，真实采集得到 missing 与 content
revision mismatch 的四份双语输出，均包含 expected revision，mismatch 输出另包含
observed revision 和 discovery 路径：

- Partial corpus:
  `scenario-lab/corpus/2026-10-15T09-17-49.068Z/`

恢复后的运行在最终 baseline 清理阶段失败：前一场景留下的有意修改副本被安全链接
helper 拒绝覆盖。因此本轮没有生成新的 manifest/review.html，也没有把 partial corpus
伪装成完整采集。lab cleanup 已改为只在隔离场景 HOME 中移除场景自有 registration
后重建。最新完整 HTML 仍为
`scenario-lab/corpus/2026-10-15T09-03-33.233Z/review.html`。

## 2026-10-15 cleanup 修复后的完整 Docker 重采集

- Command: `scenario-lab/run.ps1`
- Result: exit code 0；10 个场景、20 份报告，`en-US` / `zh-CN` 每场景各一份，
  所有 manifest result exit code 均为 0
- Corpus:
  `scenario-lab/corpus/2026-10-15T09-27-28.695Z/`
- HTML:
  `scenario-lab/corpus/2026-10-15T09-27-28.695Z/review.html`
- Cleanup: 临时 `source.bundle` 不存在；scenario run containers 为 0；个人 discovery
  skill 内容 revision 与当前 checkout canonical revision 均为
  `sha256:318de74195044576ea3bcd09b44748c51be136b4cc0e2695df50f5e862d05c11`

missing 报告包含 canonical expected revision。content mismatch 的英中双语报告与
`review.html` 均包含 discovery path
`/home/scenario-device/.agents/skills/silvermoon`、expected revision
`sha256:318de74195044576ea3bcd09b44748c51be136b4cc0e2695df50f5e862d05c11`
和不同的 observed revision
`sha256:dc92594e9bcad1bbbd51868ae30c516078e20dc9d5b706a185b3ed0e096e796d`。
静态 HTML 内容验证全部通过；当前环境没有连接 browser client，无法额外执行集成
浏览器交互。
