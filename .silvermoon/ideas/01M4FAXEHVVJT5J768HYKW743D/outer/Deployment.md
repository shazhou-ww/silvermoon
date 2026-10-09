# Deployment

## Steps

### D-S01: 准备不可变 0.4.0 发布候选

在 `origin/main` 上确认 release-grade checks、package 内容、capability manifest
和 changelog 一致。验证候选可由受控工作流发布，但本阶段不创建
`npm/silvermoon/v0.4.0` tag。

### D-S02: 固化发布 hold 边界

保留 `.github/workflows/publish-npm.yml` 作为唯一发布路径，不触发 workflow，
不创建 GitHub Release，不写入 npm registry。后续发布必须由新的明确授权启动，
并重新验证当时的 `origin/main`、tag、package 与 registry 身份。

### D-S03: 验证全新执行环境

在隔离的本地执行环境验证项目外安装的 runtime、personal skill discovery、
无项目 dependency/skill 的普通项目，以及 current、历史和 future schema
行为；对 remote/cloud Agent 记录其必须独立 provisioning 的明确边界。

### D-S04: 验证真实 Agent gate 的内容语言

在隔离环境用中英文 idea 分别运行默认输出和相反语言 override 的
`whats-next`，再由 canonical skill 形成真实 review index。保留 report 与最终
gate 作为持久证据，确认固定呈现文案来自 runtime、宿主链接由 Agent 补充，且临时
输出语言不污染内容语言；同时确认 deployment gate 使用“部署验收”“部署契约”
和部署结果问题。

## Acceptance criteria

### D-AC01: 发布候选内部身份一致

`package.json`、capability manifest、pack 结果、changelog 与 release notes
共同声明 `0.4.0`，候选来自 `origin/main`；同时证明 tag、workflow 和 registry
发布尚未发生，不把预发布验证表述成公开发布。

### D-AC02: 普通项目无需本地 Silvermoon

隔离环境中的示例项目不声明 Silvermoon dependency、不包含 repository skill，
仍可由项目外 runtime 完成项目准备；personal skill 的链接与内容由设备级
fixture 独立证明。

### D-AC03: 发布前兼容承诺成立

候选包能够验证 current 与受支持历史 schema、生成并应用迁移，同时对 future
schema 给出准确 runtime freshness 诊断；以冻结 fixture 的 package-level smoke
结果证明，且不宣称这些结果来自公开 registry。

### D-AC04: Gate 在真实宿主中完整本地化

同一候选在默认输出和相反语言 override 下形成的 review index，除 alias、ULID、
revision、路径、schema 字段和代码标识等机器契约外，所有面向人的固定文本都遵循
effective content language。证据同时证明 canonical skill 未保存另一份 gate
模板，非内建内容语言的 fallback 明确可见，且部署阶段不再显示内部世界术语。
