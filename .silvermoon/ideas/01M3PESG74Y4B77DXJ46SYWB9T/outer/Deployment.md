# Deployment

## Steps

### D-S01: 发布仓库部署契约

通过普通、非强制 Git 操作将本部署契约发布到配置的 primary branch。保留并发
历史；若 primary 移动，则先通过普通 merge 吸收双方意图。本次部署不得发布 npm
package、创建 npm release tag 或调用 npm 发布 workflow。

### D-S02: 验证已发布的 primary snapshot

刷新配置的 primary branch，证明实现验收事实、部署契约与实现提交均可从其 tip
到达。针对已发布 snapshot 运行 Silvermoon remote check，并确认 repository
release-grade checks 对相同候选保持通过。

### D-S03: 验证真实内容语言行为

从干净且与 primary 同步的仓库运行真实 CLI。创建临时中文与非内置内容语言 idea
候选，确认中文脚手架使用中文自然语言，非内置语言显式使用英文 fallback；对
`content-language-contracts` 运行 `whats-next`，确认报告实时声明 `zh-CN`
内容语言。临时验证不得改变已发布仓库状态。

## Acceptance criteria

### D-AC01: Primary 包含完整部署候选

刷新后的 `origin/main` tip 包含实现提交、精确 implementation acceptance fact
和本部署契约；`silvermoon check --remote --json` 对该 remote snapshot 报告
有效。

### D-AC02: 内容语言契约在真实 CLI 中成立

真实 CLI 的临时中文 scaffold 不包含英文自然语言占位，非内置内容语言 scaffold
明确声明英文 fallback，选中 idea 的 `whats-next --json` 报告
`details.contentLanguage` 为 `zh-CN`。命令成功退出且临时验证环境被移除。

### D-AC03: Release-grade 验证保持通过

`pnpm check` 对部署候选成功退出，覆盖 unit、contract、integration、e2e、
package、Markdown 与 skill 检查。部署证据不包含 npm package 发布、release tag
或 npm 发布 workflow 调用。
