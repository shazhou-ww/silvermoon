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
