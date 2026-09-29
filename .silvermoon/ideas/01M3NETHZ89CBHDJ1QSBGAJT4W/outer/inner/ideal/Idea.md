# 为 lifecycle 阶段提供项目级追加指导

## 意图

允许 Silvermoon 项目为 preparing、implementing 和 deploying 三个可行动阶段
提供 repository-owned phase guidance，使 Agent 在真正进入该阶段时直接获得
项目特有的写作规则、工程约束和发布检查，同时不削弱 Silvermoon 的固定流程、
revision 与人类决策边界。

## 背景

Silvermoon 的 canonical skill 和 `whats-next` lifecycle instructions 提供跨项目
一致的安全协议：repository hygiene、primary synchronization、三世界嵌套、
ledger continuation，以及 approval/acceptance 必须绑定精确 revision。这些规则
应由 Silvermoon 控制，不能交给项目任意替换。

不同项目仍有大量无法放进通用 skill 的领域要求。例如：

- preparing 时，项目可能要求 `Idea.md` 必须包含兼容性边界、迁移策略、隐私影响
  或特定非目标；
- implementing 时，项目可能要求遵守架构分层、特定测试矩阵、生成文件同步或
  性能预算；
- deploying 时，项目可能要求检查数据库备份、回滚方案、包内容、provenance、
  smoke test、可观测性和发布后核验。

今天这些要求只能散落在仓库文档、通用 Agent instructions 或操作者记忆中。
`whats-next` 即使已经安全地选中当前 idea 和 lifecycle state，也只返回
Silvermoon 的通用下一步；Agent 必须额外搜索，容易漏读、读到与已观察 snapshot
不一致的文件，或把通用流程与项目自定义 prompt 混为同一信任层。

项目需要的是由 Git 版本化、按当前阶段按需交付的补充指导，而不是可以重写
Silvermoon 协议的任意 prompt hook。

## 期望结果

### 固定的项目级 guidance 路径

项目可选择创建以下纯 Markdown 文件：

```text
.silvermoon/
└── guidance/
    ├── preparing.md
    ├── implementing.md
    └── deploying.md
```

目录和每个文件都可省略。缺少当前阶段文件表示项目没有额外指导，现有命令输出
和 lifecycle 行为保持不变。固定路径不写入 `.silvermoon/config.yaml`，因此不
升级配置 schema，也不引入路径解析、继承或 override 优先级。

三个文件分别只服务同名的 actionable lifecycle state。completed 与 abandoned
是复查/终止状态，不增加 guidance 文件；裸导航尚未选中 idea，也不提前汇总或
拼接多个阶段的指导。

### 追加而非替换

Phase guidance 是明确标注来源的项目级补充输入，永远低于系统指令、用户明确
决定、canonical Silvermoon skill 和 CLI 生成的安全/lifecycle instructions。
它不能：

- 跳过 project/repository readiness、Git hygiene 或 primary synchronization；
- 改写三世界边界、world revision 派生、approval/acceptance 或 abandoned 事实；
- 把 ledger checkbox 当作人类决定或完成证明；
- 授权 force-push、丢弃未知工作、泄露秘密或执行其他被上层规则禁止的操作；
- 把 implementing 工作塞进 Deployment，或以 guidance 取代 world contract。

Silvermoon 不尝试用关键词分析任意 Markdown 的语义冲突。CLI 负责安全读取和
标记 provenance；canonical skill 要求 Agent 在明显冲突时保留核心协议、停止
执行冲突部分并向用户说明，而不是静默让项目内容覆盖固定规则。

### 只在当前阶段成为下一步时交付

带 selector 的 `silvermoon whats-next <idea>` 先完成现有的项目检查、本地
repository hygiene、fetch、ancestry/synchronization 和 idea selection。只有
这些更高优先级步骤全部通过，且所选 idea 的状态为 preparing、implementing
或 deploying 时，才读取并附带同名 guidance。

以下路径不读取或输出 phase guidance：

- 裸 `whats-next` 的 active idea 选择；
- project setup、worktree、branch/upstream、fetch 或 synchronization 阻塞；
- selector 未找到；
- completed 或 abandoned idea；
- 纯验证和 inventory 命令的普通成功输出。

`silvermoon create-idea` 在现有项目与本地创建 preflight 全部通过后、写 scaffold
之前验证 preparing guidance。创建成功的同一份报告直接附带该指导，因为紧邻
动作就是编写 `Idea.md`；文件无效时不创建任何路径，并返回可操作的问题。文件
不存在时按现有流程正常创建。

### 与 snapshot 绑定的结构化输出

存在有效当前阶段文件时，JSON 在 command-specific observation 中增加：

```json
{
  "guidance": {
    "phase": "preparing",
    "path": ".silvermoon/guidance/preparing.md",
    "contentRevision": "<git-blob-object-id>",
    "content": "项目补充指导的 Markdown 原文\n"
  }
}
```

`whats-next` 的 guidance 与已通过同步检查的同一 repository snapshot 一致；
`create-idea` 的 guidance 与其通过本地 preflight 的同一 clean worktree/HEAD
snapshot 一致。`contentRevision` 是产生 `content` 的 Git blob object ID，
使消费者无需在命令结束后重新读取可能已经变化的路径。

guidance 不增加新的顶层 envelope 成员，不拼进 canonical `instructions`，
也不伪装成 Silvermoon 自有文案。默认 Markdown 输出在既有“下一步建议”之后
增加独立的“项目阶段指导” section，显示 phase、path、content revision，并将
正文逐行作为 blockquote 渲染，防止项目 Markdown 伪造顶层报告 section。
`--json` 保留结构化原文；输出语言 override 或 preferred language 只本地化
Silvermoon framing，不翻译、改写或解释 repository-owned guidance。

当前阶段文件不存在时省略 `guidance` 字段和文本 section，保持原报告形状。

### 按需验证与完整检查

每个 guidance 文件必须是固定目录下的 repository-owned regular file，不得经过
symlink；内容必须是无 BOM、无 NUL 的有效 UTF-8、包含至少一个非空白字符，原始
大小不超过 32 KiB。CRLF 可接受，但 command 输出规范化为 LF。内容是纯
Markdown 数据，不支持 frontmatter 配置、模板变量、环境插值、include、远端
URL 拉取或 executable hook。

`whats-next` 和 `create-idea` 只检查本次即将附带的阶段文件。另一个阶段文件
无效不会阻断当前 action；当前文件存在但无效时，报告稳定的 phase-guidance
problem、来源路径与修复要求，不输出内容或 lifecycle 成功指令。

`silvermoon check` 的 HEAD、worktree、staged、commit 和 remote targets 都检查
对应 snapshot 中的完整 guidance 目录。目录存在时只允许三个约定文件，并验证
每个已有文件；任一 structural/content problem 都使 check 以现有 invalid
语义退出 `1`。目录完全不存在或三个文件均省略仍是有效项目。

### Guidance 不是第四份契约

Phase guidance 只帮助 Agent 编写和继续当前 world。Agent 必须把适用于具体 idea
的要求落入当前 `Idea.md`、`Implementation.md` 或 `Deployment.md`，并同步相应
ledger stable IDs；例如 `deploying.md` 中的 smoke-test 建议必须成为可验证的
`D-Sxx` / `D-ACxx`，实际执行证据再记录于 ledger。

guidance 文件本身不批准 ideal、不验收 implementation/deployment，也不证明任何
检查已经执行。修改项目 guidance 不直接改变既有 idea 的 world revision，不
自动撤销或重开 completed idea；对 active idea 产生实质要求变化时，Agent 按
现有规则更新对应 world contract，由正常 revision 与人类决定重新建立事实。

## 范围

### 范围内

- 引入 `.silvermoon/guidance/{preparing,implementing,deploying}.md` 固定约定。
- 实现 regular-file、symlink、UTF-8、BOM/NUL、非空、32 KiB 和目录 entry
  validation，以及 snapshot-specific Git blob revision。
- 在选中 actionable idea 且所有更高优先级 readiness 通过后，将当前阶段
  guidance 直接加入 `whats-next` 的结构化与 Markdown 输出。
- 在 `create-idea` 成功报告中直接加入 preparing guidance，并保证无效文件在
  scaffold mutation 前阻塞。
- 让 `check` 的全部 snapshot targets 验证完整 guidance 目录，同时保持缺省
  项目完全兼容。
- 更新 canonical skill，明确来源、优先级、冲突处理和“materialize into current
  world contract + ledger”责任。
- 更新 CLI/API report contract、reference/operations/getting-started 与
  unit、contract、integration、snapshot 和 installed-package E2E。

### 范围外

- 允许项目替换、删除、重新排序或重新定义 Silvermoon 的 canonical prompt、
  safety rules、readiness gates 或 lifecycle instructions。
- per-idea、per-user 或 global guidance，项目之间的继承，共享片段，config
  path override，插件、模板语言或 conditional DSL。
- completed/abandoned guidance，裸导航中的多阶段预览，或在 `list-ideas`
  inventory 中携带 prompt 内容。
- 自动把 guidance 原文复制进 idea、自动修改 world contract/ledger，或仅凭
  guidance 变化自动使 approval/acceptance 失效。
- 语义审查或自动判定自然语言冲突、自动执行命令、解析 include/link、联网拉取
  内容，或翻译 repository-owned Markdown。
- 让 `create-idea` 自动创建 guidance 目录或示例文件；没有自定义需求的项目
  不产生额外文件。

## 约束

- guidance lookup 必须发生在当前 phase 确实成为最高优先级 action 之后；不得
  因提前读取项目 prompt 掩盖 setup、hygiene 或 synchronization 问题。
- `create-idea` 必须在任何 scaffold write 前完成 preparing guidance validation；
  失败不能留下半创建路径或 success-shaped observation。
- 同一报告中的 path、contentRevision 和 content 必须来自同一 snapshot；不得
  先报告 revision，再从可变化的当前文件系统读取正文。
- `contentRevision` 必须支持 repository 的 Git object format，不能假设只有
  SHA-1；正文解码和 CRLF 规范化后仍须与所标识 blob 的规范内容一致。
- 缺失 guidance 是正常的 optional state；存在但不可安全读取必须显式失败，
  不得静默按缺失处理或回退到其他 phase。
- 32 KiB 限制按原始 blob bytes 计算；不得截断后继续成功，也不得把 guidance
  正文写入 trace、错误日志或其他隐式持久化位置。
- Markdown renderer 必须隔离项目正文，避免其中的 heading、code fence 或伪造
  diagnostics 改变 Silvermoon 报告结构。
- canonical instructions 与 guidance 在 JSON 和文本中保持可区分 provenance；
  skill 只消费 CLI 报告中的已验证 guidance，不在命令后另行读取路径。
- guidance 要求必须通过当前 world contract 与 ledger 才能成为 idea-specific
  可审查事实；人类 decision 仍只记录精确 world revision。
- 未配置 guidance 的项目和现有三个命令的 readiness、输出、退出码与 side
  effects 必须保持兼容。
