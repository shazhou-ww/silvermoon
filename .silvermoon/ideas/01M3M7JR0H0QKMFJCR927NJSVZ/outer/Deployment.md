# 现实部署契约

## Steps

### D-S01: 验证远端主分支的术语边界

在现实部署契约发布后，从配置的 primary 重新获取远端快照，验证正式文档、
canonical skill、CLI 源码和 schema 使用理想世界、主体世界、现实世界及对应
文档契约名称，不再使用“道心”“内景”“现世”；同时确认两份 README 仍保留
允许的仙侠品牌文案。

### D-S02: 验证安装包中的 CLI 与 skill

从已发布到 primary 的候选构建 npm package，在隔离临时目录中安装并运行
installed-package e2e，确认打包后的 CLI、canonical skill、项目 skill 注册和
中文 lifecycle 指导与仓库内验证结果一致。本 idea 不发布新的 npm 版本。

## Acceptance criteria

### D-AC01: Primary 快照满足正式术语契约

配置的远端 primary 包含已验收实现，`silvermoon check --remote` 通过；针对远端
快照的限定路径搜索证明正式 surfaces 没有仙侠别名，而 README 继续包含品牌
用语。

### D-AC02: 打包安装后的行为保持一致

`pnpm pack:check` 和 `pnpm test:e2e` 针对发布后的 primary candidate 通过，
证明 npm package 包含同步的 canonical skill，并且安装后的 CLI 保持兼容。
