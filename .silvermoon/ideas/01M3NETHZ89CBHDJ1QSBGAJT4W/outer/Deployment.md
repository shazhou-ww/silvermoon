# Deployment

## Steps

### D-S01: 发布明确授权的 Silvermoon 版本

在 implementation 获得验收且用户明确授权版本后，从 `origin/main` 可达提交
通过不可变 npm tag 和受保护 GitHub Actions trusted-publishing workflow 发布
包含 phase guidance 的 Silvermoon 版本。

### D-S02: 在真实项目验证三个阶段的指导交付

从 npm registry 安装目标版本，在消费者 repository 创建三个 guidance 文件和
覆盖 preparing、implementing、deploying 的 ideas。逐一运行选中
`whats-next` 与 `create-idea`，核对 JSON/Markdown 内容、blob revision、阶段
隔离、输出语言边界及 world/ledger materialization 指引。

### D-S03: 验证缺省、阻塞与恶意内容边界

在无 guidance、repository readiness 阻塞、terminal idea、缺失当前文件、
其他阶段无效、当前阶段无效和 hostile Markdown 场景运行已发布 CLI。对全部
`check` targets 复验完整目录，并记录退出码、无 mutation/network、trace 与
渲染隔离证据。

## Acceptance criteria

### D-AC01: 已发布 CLI 可按阶段交付项目指导

registry 安装版本在三个 actionable states 中只返回对应 guidance；成功
`create-idea` 返回 preparing guidance。JSON 的 phase/path/contentRevision/
content 与 Markdown section 一致，并通过真实 Git blob hash 核对。

### D-AC02: 更高优先级动作与终止状态不泄露 guidance

project、hygiene、fetch 或 synchronization 问题仍先行，裸导航、未知 selector、
completed 与 abandoned 不读取或输出任何 phase content。通过隔离消费者、
读取 spy/访问审计和完整状态矩阵证明。

### D-AC03: guidance 缺省兼容且错误按作用域阻塞

无 guidance 的现有项目行为与发布前一致；当前阶段文件无效时得到可操作问题，
且 `create-idea` 不留 scaffold。其他阶段无效不阻止当前 `whats-next`，但同一
snapshot 的所有 `check` targets 都以 invalid 退出。通过实际进程与文件树前后
对比证明。

### D-AC04: 项目 Markdown 保持数据边界

包含 headings、code fences、模板标记、URL 与命令片段的 guidance 只按原文
返回并安全引用，不改变报告 section、不联网、不执行、不被语言 override 翻译，
也不进入 trace。通过 hostile fixture、封锁 network/process 和输出检查证明。

### D-AC05: 项目要求仍由 world revision 与人类决定承载

packaged skill 明确把适用 guidance materialize 到当前 world contract 与
ledger，并在冲突时保留 Silvermoon 核心协议。guidance 文件本身不产生 approval、
acceptance 或完成证据。通过安装包 skill 内容、代表性 Agent scenario 和
status/world revision 前后对比证明。

### D-AC06: 已发布版本保持既有命令兼容

同一 registry 版本的 `whats-next`、`create-idea`、`check` 以及无 guidance
consumer smoke 全部通过；固定路径不要求 config schema 升级或项目迁移。
通过 installed-package E2E、schema validation 和 clean consumer setup 证明。
