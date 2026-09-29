# Implementation

## Steps

### I-S01: 分离输出语言与内容语言

在 language 模块中定义 `en-US`、`zh-CN` 内置输出语言集合及规范化校验，并为
command observation 增加独立的一次性输出语言通道。保留
`idea > project > user > en-US` 的内容语言解析和任意 canonical BCP 47 存储，
不再让 renderer 必须借用 `configuration.preferredLanguage` 决定 override。

### I-S02: 扩展 CLI 与 command contract

为 `whats-next` 和 `check` 注册 `--language <tag>`，在 Commander 与直接 API
入口校验 supported output locale，并把 canonical override 或 `null` 写入
`intention.args.language`。更新 help、trace/recheck 上下文与参数传递，同时保持
`create-idea --language` 的任意 BCP 47 持久化行为。

### I-S03: 贯通 whats-next 全部输出路径

让 override 在 project observation 前进入 localizer，并在选中 idea 后继续优先
于 status language。统一本地化 setup、repository、navigation、selection、
lifecycle、outcome 和 retry instructions；所有重试命令携带 canonical
`--language`，但 observation 中的内容语言与任何持久化文件不变。

### I-S04: 贯通 check 的全部 target 与失败路径

将输出 override 传入 HEAD、staged、worktree、commit、remote 和无 Git/无效
revision 等 check 路径。调整 check renderer 在 configuration 尚不可用时仍从
command intent 获得 locale，并保持 target 选择、snapshot 内容、验证结果与
退出码不变。

### I-S05: 更新 skill、文档与回归覆盖

更新 canonical skill，允许用户明确请求时为 `whats-next`/`check` 传入临时
output override，并要求 hygiene retry 保留该参数。同步 reference、getting
started、CLI examples 与生成 skill；增加 language、CLI、dialogue、integration、
contract 和 installed-package E2E 测试，运行完整 release-grade 验证。

## Acceptance criteria

### I-AC01: 支持语言规范化且严格

`EN-us` 与 `zh-cn` 分别规范为 `en-US`、`zh-CN`；空值、非法 tag 以及
`en`、`zh`、`fr-FR` 等未内置 tag 在 CLI action、repository read、fetch 或
mutation 前返回 usage exit `2`。通过 language unit tests、CLI spy 和实际进程
测试证明，直接 API 也不能绕过校验。

### I-AC02: whats-next override 覆盖显示但不覆盖内容偏好

`whats-next --language en-US|zh-CN` 的 Markdown 与 JSON natural-language
值在 setup、repository、navigation、unknown selector 和所有 lifecycle state
中使用指定语言；显式 override 高于 selected idea、project 和 user language。
`configuration.preferredLanguage`、status/config 文件及 world revision 均保持
原内容偏好与字节不变，通过优先级矩阵和前后快照证明。

### I-AC03: check override 覆盖所有验证表面

`check --language` 与默认、HEAD、staged、worktree、commit、remote、JSON、
invalid 和 unavailable 路径组合时，Silvermoon 自有标题、结果和 problem framing
使用指定语言，同时 target、observation state、problems、退出码和受检 snapshot
与无 override 调用一致。通过 unit、integration 与 CLI contract matrix 证明。

### I-AC04: 调用意图与重试语言可观察

`whats-next` 和 `check` 的 `intention.args.language` 始终为 canonical override
或 `null`；JSON key 与 enum 不本地化。需要 reobserve 的
`whats-next --language <tag>` 报告生成保留同一 canonical option 的重试命令，
保证一次用户意图不会在中途切换语言。通过 exact-shape 和 instruction tests
证明。

### I-AC05: create-idea 与持久化语言保持兼容

`create-idea --language fr-FR` 等任意规范 BCP 47 继续可用并写入新 idea；
无参数时继续动态继承。项目、用户和 idea schema 仍接受既有 canonical tag，
新输出 allowlist 不参与存储 validation。通过现有 fixture 加针对性回归测试
证明。

### I-AC06: 文档、skill 与发布级检查一致

CLI help、reference、getting-started 和 canonical skill 清楚区分临时 output
override 与持久化 content language，并列出内置语言和 precedence。
`pnpm check`、`pnpm check:skills`、Markdown links、package/installed E2E、
`git diff --check`、`silvermoon check --worktree` 与 staged check 全部通过。
