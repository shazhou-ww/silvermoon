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
