# Implementation

## Steps

### I-S01: 分离设备与项目整备

移除项目 package、`node_modules`、runtime 版本和 repository skill 的 adoption
要求，让所有命令与 Agent bridge 使用当前设备的唯一 runtime。把 personal skill
链接、runtime 身份和带 24 小时缓存的 latest 查询收敛到设备整备。

### I-S02: 建立 Schema capability 与准备流程

建立 runtime-owned schema capability manifest 和逐文件 registry，使
`whats-next` 一次区分 validity、历史 schema migration readiness 与 future
schema。future schema 必须触发即时 runtime freshness 刷新并保留准确诊断。

### I-S03: 完成迁移链与 0.4.0 契约

将现有 v1→v2 安全迁移纳入可扩展 migration graph，同步公开 schema、报告、
文档、skill 和 release metadata，并把取消项目级 runtime 选择作为 `0.4.0`
兼容边界。

### I-S04: 将 Agent gate 指引收敛到 runtime report

扩展 `whats-next` 的 `response.review`，由 runtime 按 effective content language
提供结构化 gate presentation，包括本地化标签、文档角色和绑定准确 revision 的
决定问题；`outputLanguage` 只控制当前命令的报告框架，不改变 gate 语言。同步精简
canonical skill，使其遵循 report 指示并只补充宿主链接、审阅重点和必要证据选择，
不再维护重复的固定语言 gate 模板。

## Acceptance criteria

### I-AC01: 唯一 runtime 与设备 skill

无 `package.json`、任意 Node 项目和非 Node 项目都由同一 executable 得到一致的
项目判断，且不访问项目 Silvermoon 安装或 skill。隔离 home 测试证明 personal
skill 链接、source checkout 例外和 24 小时 latest 缓存均属于设备整备。

### I-AC02: 完整且可解释的 Schema readiness

混合 current、历史、无效和 future schema 的 fixture 由 `whats-next` 一次返回
全部路径级结论；测试证明 future schema 绕过例行缓存，并区分可升级、latest
仍不支持和 registry 不可用。

### I-AC03: 可迁移的 0.4.0 候选

所有受支持历史 schema 都有经过 digest、恢复和语义守恒测试的连续迁移路径；
package、manifest、公开 schema、文档和 release checks 一致声明 `0.4.0` 边界，
并通过 release-grade `pnpm check`。

### I-AC04: 内容语言驱动的单一 gate 契约

契约测试证明中英文 idea 在相反 `outputLanguage` override 下仍分别得到由
effective content language 驱动的 gate presentation，非内建内容语言具有显式
localization fallback，而不会静默采用输出语言。skill contract 证明 Agent 直接
采用 `response.review` 的 presentation，且不再复制英文或中文 gate 字面模板；
完整 release-grade `pnpm check` 通过。
