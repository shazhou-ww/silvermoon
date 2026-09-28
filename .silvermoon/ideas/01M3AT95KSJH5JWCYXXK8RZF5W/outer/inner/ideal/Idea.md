# 规范化 whats-next 推演与 Silvermoon 双视图输出

## Intent

让 `silvermoon whats-next` 成为一个确定性的下一步推演器：它按固定优先级判断
项目是否可由 Silvermoon 管理、仓库是否已准备好、用户接下来要处理哪个 idea，
并将结果归纳为“项目需配置、仓库需同步、任务待处理、闲来无事”四种递进状态。
报告完整列出当前状态下发现的问题，并生成覆盖全部建议的自然语言 instructions，
让 Agent 尽量一次推进到下一个状态后再 reobserve。

Agent 和人类默认读取由统一内部对话模型渲染的自然语言文本。可选 `--json` 序列化
同一份 intention、observation、outcomes 和 instructions；renderer 只负责将四段
语义组织成对话，不维护第二套推演逻辑。

## Context

现有实现事实上已经依次检查 onboarding、Git hygiene 和 idea lifecycle，但这个
顺序没有成为清晰的公共推演模型。输出改进也因此被描述成逐一修补若干 action：
文本模式漏掉部分 details，JSON 又在 `selectedIdea`、`onboarding`、message 和
details 之间重复相同事实。

现有 onboarding 还把 Silvermoon 通过 npm 分发这一事实错误地投射到了目标项目：
它要求项目拥有 `package.json`、package manager、Silvermoon dependency 和
`node_modules`。Silvermoon 必须同样适用于 Python、Rust、Go、文档及其他非 Node
仓库；CLI 的分发来源不是项目配置。

更根本的问题是，调用方式本身表达了用户意图。显式 selector 表示用户选择继续
或复查某个 idea；裸 `whats-next` 只是在询问可选的下一项工作，不能因为恰好只有
一个 active idea 就替用户选中它，因为用户仍可能希望讨论并创建新 idea。

## Desired outcome

- 推演严格分成项目就绪、仓库就绪、idea 导航与生命周期三层；前一层未通过时
  不运行或暴露后一层结论。
- 每次成功观测只进入四种状态之一；当前状态下的全部已知 problems 和有序建议
  一次返回。
- Agent 可以按 instructions 顺序批量执行当前状态中前置条件已满足且结果符合
  预期的建议，
  完成该层后再调用一次 `whats-next`。遇到冲突、并发变化或意外结果时立即停止，
  不继续套用陈旧建议。
- 裸 `whats-next` 始终把全部 active ideas 和“讨论并创建新 idea”作为并列
  option，不因 active idea 的数量为零、一个或多个而改变用户意图。
- `whats-next <selector>` 才选中具体 idea，并根据其状态给出 prepare、
  implement、deploy 或终态 review 指示。
- 默认文本是 Agent 与人类的主要接口；`--json` 是同一内部对话模型的结构化
  serialization，不是可执行计划 AST。不新增 YAML 输出。
- `whats-next` 的 observation 只使用
  `project-setup-required`、`repository-sync-required`、`task-pending` 和
  `idle` 四种状态；一个状态隐含前序层已通过及后续层尚未进入。
- JSON 中 observation、outcomes 和 instructions 各守边界；文本不遗漏执行当前
  建议所需的路径、提交、revision、候选项或命令。
- 大型 worktree 只内联有固定预算的路径样例，同时报告完整 counts、omitted 数和
  精确检查命令，不能让返回大小随文件数量无限增长。
- 项目就绪判断不假定目标仓库使用 npm 或任何其他语言生态的 package manager，
  也不要求项目声明或安装 Silvermoon dependency。

## Three-layer decision model

### Layer 1: 项目就绪

先判断当前目录是否具备可靠运行 Silvermoon 的前提，包括：

- 当前目录已经初始化为 Git 仓库；
- 当前运行的 Silvermoon 能理解项目配置声明的 schema version；
- 项目配置存在，并在该 schema 下结构与语义均合法；
- `.agents/skills/silvermoon` 存在，且内容与当前运行的 Silvermoon 随附的
  canonical skill 完全一致。

项目不声明或锁定 Silvermoon CLI 版本。临时、全局、project-local、独立工具或
source checkout 等执行来源均可作为本次运行实例，只要它兼容当前配置 schema。
目标项目不需要 `package.json`、Silvermoon dependency 或 `node_modules`。

`.agents/skills/silvermoon` 是唯一要求和校验的项目级 skill 注册位置。Silvermoon
不扫描 `.claude`、`.cursor`、`.github` 等 Agent 专属目录，也不猜测项目使用哪个
coding Agent；不兼容 `.agents/skills` 的 Agent 可以维护自己的适配副本或链接，
但那些路径不参与项目就绪判定。skill 修复通过 `npx skills` 的 `universal` target
完成，不写死某个 Agent。

项目层同时报告全部 problems，并在 instructions 中按以下顺序列出全部 applicable
建议：

1. 初始化 Git repository；
2. 换用能理解配置 schema version 的 Silvermoon；
3. 创建或修复项目配置；
4. 将当前运行实例随附的 canonical skill 同步到
   `.agents/skills/silvermoon`。

只要存在 blocking problem，就停止后续 layer 的推演。项目层用有序 problems
报告全部观测事实；instructions 说明依赖、执行顺序和完成整层后的 recheck 命令，
不能只返回第一条建议，迫使 Agent 每修一项就重复调用。尚未满足依赖的建议仍可
列出，但必须明确其前置条件，不能伪装为当前可执行。可确定修复方式的配置问题
不得退化成笼统失败。

可解释的配置、I/O、网络、权限和外部工具问题都属于 observation problem 或
failure outcome；只要 Silvermoon 能准确说明事实并给出恢复建议，就仍是一次正常
对话，不使用进程失败掩盖它们。只有内部故障导致无法形成完整可信 envelope 时，
才返回 Silvermoon 自身错误。

### Layer 2: 仓库就绪

项目就绪后，检查当前 checkout 和 configured primary 是否能安全承载下一次 idea
操作。仓库层完整报告本层已知事实与建议，并按以下优先级排序：

1. 在访问 remote 之前检查当前 worktree；冲突优先于普通修改。
2. 若存在 staged、unstaged 或 untracked 内容，报告每类完整 count，并在固定
   item/byte 预算内按稳定顺序内联路径样例；超出部分报告 `omitted`，同时提供
   结构化 Git 命令用于读取完整路径和精确 diff。Agent 随后提交、隔离，或在获得
   明确授权后放弃；Silvermoon 不得自动丢弃未知工作。尚无首个 commit 的仓库也
   在这里审查候选内容并形成初始 commit。
3. 若 worktree 已干净但仍没有可用 HEAD，给出建立初始 primary commit 的明确
   action，不把它误报为项目未配置或笼统 fatal error。
4. 本地 checkout 就绪后，确保它是非 detached branch，且其 upstream 指向
   configured `primaryRepository` 的 `primaryBranch`。本地 branch 名不需要等于
   `primaryBranch`；缺失或错误的 upstream 作为明确 finding 和 remediation
   报告。
5. 只有本地 hygiene 通过后才 fetch configured primary。remote URL、branch、
   网络和权限问题都属于仓库同步，不回退成项目配置层的 package/tool 问题。
6. 比较当前 HEAD 与本次 fetch 观测到的 configured primary tip，报告两端 commit
   和 ancestry 关系，并给出建议：
   - 本地落后时建议 fast-forward；
   - 双方分叉时建议保留两边历史并 integrate；
   - 本地领先时建议先验证，再以 observed primary 为 expected remote tip 普通
     推送；
   - 两者一致时才进入 idea 层。

这一层统一表示“仓库尚未准备好”，而不只表示“worktree 不干净”：干净的
worktree 仍可能没有有效 HEAD、缺少正确 upstream、无法 fetch、落后、领先或
分叉。`whats-next` 在这一层只报告事实和建议，不 checkout、fast-forward、
rebase、merge 或 push。

### Layer 3: Idea 导航与生命周期

第三层先尊重 request，再推导 lifecycle：

- 裸 `whats-next` 不选择 idea。其 instructions 始终包含：
  - 所有且仅有状态为 `preparing`、`implementing`、`deploying` 的 active ideas；
  - 一个讨论新目标并调用独立 `silvermoon create-idea` 命令的 option。
- `completed` 和 `abandoned` ideas 不参与裸调用的默认导航。
- 显式 selector 必须精确匹配 ULID 或唯一 alias：
  - `preparing` 返回 Ideal World 的准备与审批指示；
  - `implementing` 返回 Inner World 的实现与验收指示；
  - `deploying` 返回 Outer World 的验证与验收指示；
  - `completed` 返回复查已有定义或创建新 idea 的指示；
  - `abandoned` 返回保持放弃、恢复该 idea 或另建 idea 的指示；
  - 不存在或不唯一时记录带恢复方式的 problem，不猜测候选。

显式创建不是 `whats-next` 的 request。`silvermoon create-idea` 是独立公共入口，
复用相同的项目与仓库 readiness preflight，并在通过后保持创建意图；它不能被
active idea 导航替换。

## Output contract

完整 TypeScript 类型草案见
[`output-contract.ts`](./output-contract.ts)。它是本契约的阅读辅助材料；语义仍以
本文为准。

### Unified JSON envelope

所有公共子命令的 `--json` 使用同一个顶层结构：

```json
{
  "intention": {
    "command": "whats-next",
    "args": {}
  },
  "observation": {},
  "outcomes": [],
  "instructions": ""
}
```

- `intention.command` 是 `whats-next`、`create-idea` 或 `check`；
  `intention.args` 是展开默认值并规范化后的目标与行为参数。`--json` 只选择输出
  格式，不属于业务意图，不能出现在 args 中。
- `observation` 是三个命令共享的 repository observation。它记录观察对象、成功
  读取的 Silvermoon 配置、idea inventory 和当前 problems；相同 repository
  version 不因调用命令不同而产生不同 observation 形状。
- `outcomes` 按执行顺序记录本次调用实际尝试的高层 repo 副作用操作，例如
  `fetch-primary` 或 `create-idea-scaffold`。每项只有稳定 `type`、
  `success | failure` 状态和使用 effective language 的 `summary`；summary 说明
  做了什么、结果如何，以及发生部分变化时已知的实际影响。
  成功 fetch 也属于副作用。`outcomes: []` 表示没有尝试 repo 副作用。
- `instructions` 只保存基于同一次 intention、observation 和 outcomes 得出的
  下一步建议，包括全部有序建议、条件与 reobserve 时机；不复制前三段的总述。

### Exit status

退出码描述 Silvermoon 是否成功完成这次对话，而不是被观察仓库是否健康：

- `0`：形成了完整可信 envelope。所有四种 `whats-next` 状态、`check` 发现
  validation findings、`create-idea` 被 readiness 阻止，以及网络、权限、本地
  mutation 等 outcome 失败或部分完成，只要被准确记录并给出恢复建议，都返回
  `0`。
- `1`：Silvermoon 内部故障使其无法形成完整可信 envelope。
- `2`：未知命令、缺少必填参数或互斥参数等 CLI 用法错误；此时尚无有效
  intention，不要求输出完整 envelope。

JSON 不再包含顶层 `ok`。程序不能用 problems 是否为空或 outcome 是否失败来推断
进程退出码。

统一 observation 使用以下形状：

```json
{
  "state": "repository-sync-required",
  "root": "D:\\Code\\silvermoon",
  "version": {
    "type": "worktree"
  },
  "configuration": {
    "primaryRepository": "https://example.com/owner/repository.git",
    "primaryBranch": "main",
    "preferredLanguage": "zh-CN"
  },
  "ideas": {
    "counts": {
      "preparing": 2,
      "implementing": 1,
      "deploying": 0,
      "completed": 10,
      "abandoned": 1
    },
    "activeIdeas": []
  },
  "problems": [
    {
      "type": "worktree-changes",
      "summary": "..."
    }
  ]
}
```

- `state` 只能是 `project-setup-required`、`repository-sync-required`、
  `task-pending` 或 `idle`。
- observation 是按 state 判别的 union，而不是所有字段一律必填：
  - `project-setup-required` 再以
    `observedThrough: root | version | configuration | ideas` 形成累进 union；
    每个 variant 只声明已经可靠形成的字段，没有 optional、null 或伪造零值。
    `observedThrough` 只表示 observation 的完整性边界，不限制 problems 一次报告
    所有可独立观察的问题。
  - `repository-sync-required` 要求 version、configuration 和 ideas 均已可靠
    形成，并包含非空 problems。
  - `task-pending` 和 `idle` 要求全部观察字段完整且 problems 为空；idle 还保证
    active idea 数量为零。
- `version` 是 `worktree`、`staged`、`commit` 或 `remote`。commit intention 中
  保存调用者请求的 revision，observation 只保存实际解析出的 commit；无法解析或
  fetch 时 commit 为 null，原因写入 problems。
- `configuration` 包含 primary repository、primary branch 和按
  idea/project/user/default 优先级解析出的非空 preferred language；配置缺失、
  无效或 schema 不兼容时不产生 configuration 字段。
- `ideas.counts` 始终包含 preparing、implementing、deploying、completed 和
  abandoned 五种状态的数量；`activeIdeas` 只列 preparing、implementing 和
  deploying ideas，每项仅含 `id`、可选 `alias` 和 `state`。无法可靠检查 idea
  layout 时不产生 ideas 字段，不能用零值伪装成成功观察。
- problems 按优先级排序；每项只有稳定、非本地化的 kebab-case `type` 和使用
  preferred language 的 `summary`。summary 承载必要 evidence；problem 不包含
  remediation，全部建议只在 instructions 中。problems 仅表达项目整备和仓库
  整备问题；idea 数量和 lifecycle state 是正常事实。
- 大型集合使用公共、确定且有契约测试的 item/UTF-8 byte budget；problem summary
  报告总数、内联样例和 omitted 数，instructions 提供读取完整事实的精确命令。

### Default natural-language output

默认模式由同一 envelope 按固定顺序渲染四段对话：

1. **意图**：根据 `intention.command + intention.args` 说明 Silvermoon 对调用者
   意图的理解；JSON 中不额外保存 intention summary。
2. **观察**：根据 command-specific observation 的 state、problems、ideas 等事实
   说明当前世界；JSON 中不额外保存 observation summary。
3. **动作与结果**：逐项呈现 `outcomes` 的操作及结果；空数组明确说明本次没有
   尝试 repo 副作用。
4. **下一步**：呈现 `instructions`。

renderer 只负责 effective language 下的段落标题、连接语和排版，不增加新判断或
重新解释事实。最终文本必须让 Agent 无需了解 JSON schema、猜测仓库状态或每完成
一项建议就重复调用，即可安全推进完当前状态；它必须包含必要的 hygiene 摘要、
分支与提交关系、发布保护值、world entry、decision field、revision、导航 option
及命令，并在不应继续时明确停止条件和恢复条件。

YAML 不在公共输出中：它没有提供独立能力，却引入隐式类型、缩进、多行字符串和
解析器差异。

## Scope

### In scope

- `whats-next` 的三层控制流、层内优先级和 request 路由。
- 移除目标项目必须是 npm package、声明 Silvermoon dependency、存在
  `node_modules` 或使用 project-local CLI 的假设；改为配置 schema compatibility。
- 统一 `.agents/skills/silvermoon` 注册位置及其与本次运行实例 canonical skill
  的内容一致性检查。
- 裸调用统一的“active ideas + 新 idea”选择语义，以及不再自动继续唯一 active
  idea。
- 三个公共子命令统一的 intention/observation/outcomes/instructions 内部对话
  envelope，以及默认四段式文本 renderer。
- 四状态 whats-next observation、完整 problems/instructions 报告，以及大型
  worktree 的有界 summary。
- 项目就绪报告与 lifecycle/hygiene action 之间的统一边界。
- CLI、schema/契约、skill、参考文档及单元、契约、集成和端到端测试同步。

### Out of scope

- `check` 的验证规则和验证目标语义；只统一其输出 envelope。
- idea revision、审批、实现验收、部署验收及 abandoned 状态的派生规则。
- 为项目新增 CLI version pin、package-manager integration 或 Silvermoon
  dependency manifest。
- 让 `whats-next` 通过新参数主动 checkout、fast-forward、rebase、merge 或更新
  worktree；这可以作为后续独立能力讨论。
- 由 `whats-next` 自动 checkout、merge、编辑、提交、stash、删除、推送或记录
  人类决策；它仍然只观测并给出下一步。
- 为旧字段、旧 action 路由或 YAML 保留兼容别名。

## Constraints

- 同一次报告中的 intention、observation、outcomes 和 instructions 必须来自同一
  次不可混用的调用；instructions 不得引用 observation 中不存在的陈旧事实。
- 层与层之间严格短路；任何路径都不能为到达 idea action 而跳过项目或仓库修复。
- 保留未知与并发工作；不 force-push，不静默改写历史，不自动放弃本地修改。
- explicit create、explicit selector 和裸导航三种 intent 在 hygiene 重试后保持
  不变。
- 只有发生可观测变化后才 recheck；一次报告不得要求 Agent 通过轮询获得同一事实。
