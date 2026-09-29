# 为导航与检查增加输出语言覆盖

## 意图

让 `silvermoon whats-next` 和 `silvermoon check` 支持显式的
`--language en-US|zh-CN`，使用户能为单次调用选择 Silvermoon 内置报告语言，
同时不修改 idea、项目或用户配置中的持久化内容语言偏好。

## 背景

Silvermoon 已支持 user、project 和 idea 三层 preferred language，并允许
`create-idea --language <tag>` 把任意规范 BCP 47 tag 持久化到新 idea。该语言
既帮助 Agent 决定后续自然语言内容，也被当前 renderer 用于选择 CLI 文案。

但 `whats-next` 与 `check` 没有一次性覆盖能力。用户若临时需要英文日志、中文
排障说明或固定语言的自动化证据，只能修改共享配置或 idea 状态；这种修改会
产生不必要的仓库 revision，并把“本次如何显示”与“内容长期使用什么语言”
混为一谈。

当前 renderer 还从 `observation.configuration.preferredLanguage` 推断显示语言。
当 Git、配置或 snapshot 在 configuration 可用前失败时，该字段不存在，输出
会回退英文，即使调用者明确希望中文。选中 idea 后，idea language 也会覆盖
显示语言，使调用者无法临时选择另一种 CLI 输出而保持内容偏好不变。

## 期望结果

`whats-next` 和 `check` 都接受可选 `--language <tag>`。交互输入先规范化大小写；
`EN-us` 解析为 `en-US`，`zh-cn` 解析为 `zh-CN`。当前内置输出语言集合严格为
`en-US` 与 `zh-CN`，其他值即使是有效 BCP 47 tag 也在任何 repository 观测、
fetch 或 mutation 前以 usage error 拒绝。

显式输出语言在本次调用中优先于 idea、project、user 与默认语言，覆盖
Silvermoon 自有的 Markdown 标题、意图、状态说明、problem summary、outcome
summary、instructions 和 check 结论；JSON 的字段名、枚举、标识符、路径、
revision 和原样外部工具信息保持稳定。重试指令保留同一 `--language`，直到
本次用户意图完成。

输出 override 仅控制本次报告的呈现，不改变
`observation.configuration.preferredLanguage` 所代表的持久化内容偏好，不写入
idea status、项目配置或用户配置，也不改变 Agent 应为 world 文档与 ledger
使用的内容语言。未提供 override 时，现有
`idea > project > user > en-US` 解析与显示行为保持不变。

`create-idea --language` 保持现有语义：继续接受任意规范 BCP 47 tag，将显式值
持久化到新 idea，并在未提供时动态继承。本 idea 不把它限制为两种内置输出
语言。

## 范围

### 范围内

- 为 `whats-next [idea]` 与所有 `check` target 增加
  `--language <tag>` CLI/API 参数。
- 建立明确的内置输出语言 allowlist，目前仅含 `en-US` 和 `zh-CN`，并在接受
  canonical casing 变体后返回规范 tag。
- 定义输出 override 高于持久化内容语言的双轨解析，不改变现有 content-language
  inheritance 或 storage schema。
- 在 `intention.args.language` 中以 canonical tag 或 `null` 暴露调用意图，
  让 JSON 消费者能区分显式覆盖与继承显示。
- 让 override 从观测开始就生效，覆盖缺失 Git、配置错误、skill drift、仓库
  同步、未知/已选 idea、fetch outcome、check valid/invalid/unavailable 等路径。
- 让 `whats-next` 的 repository/project 重试命令保留相同 language override。
- 更新 CLI help、reference、getting-started、canonical skill 和自动化测试，
  并保持 packaged skill 副本同步。

### 范围外

- 将 `whats-next` 或 `check` 的 override 写入 `status.yaml`、
  `.silvermoon/config.yaml` 或用户配置。
- 覆盖或重写持久化的 idea/project 内容语言，或因显示语言变化而产生 world
  revision。
- 限制现有 `create-idea --language`、idea `language` 或
  `preferredLanguage` 只能使用 `en-US`/`zh-CN`。
- 新增第三种内置 CLI 翻译、自动翻译任意 BCP 47 语言，或改变未覆盖调用的
  既有 fallback 行为。
- 本地化 CLI command/option 名、JSON key、problem type、state、schema 字段、
  Git revision、路径或第三方工具原始错误。
- 为 language override 创建环境变量、持久化 session 或隐式记住上次选择。

## 约束

- 支持集合必须集中定义并可测试；输入先按 BCP 47 规范化，再进行严格 membership
  检查。空值、非法 tag、`en`、`zh`、`fr-FR` 等非内置值均使用现有 CLI usage
  error 约定退出 `2`。
- CLI parser 与直接调用的 command API 都必须拒绝不受支持的 override，不得只在
  Commander 表面校验而允许程序化调用绕过。
- override 必须在任何 observation 前解析，因此即使项目配置缺失、损坏或
  snapshot 不可用，Silvermoon 自有文案仍使用请求语言。
- `configuration.preferredLanguage` 保持持久化内容语言的有效解析结果，不得被
  临时显示 override 冒充；renderer 必须使用独立的输出语言来源。
- `whats-next --language` 选择带其他持久化 language 的 idea 时，报告以 override
  显示，但 lifecycle 内容语言事实与 status 文件保持不变。
- `check --language` 必须与 `--remote`、`--commit`、`--staged`、`--worktree`
  以及 `--json` 正交组合，不改变 target 互斥规则、验证结论或退出码。
- 本地化只覆盖 Silvermoon 拥有的自然语言 framing；外部 Git/文件系统错误正文
  可以原样嵌入，但不得导致报告其他部分混用错误 locale。
- 未显式提供 override 的既有命令输出、配置继承、idea 持久化和 lifecycle
  决策必须保持兼容。
