# Ledger

## Implementation

### Implementation steps

- [x] **I-S01:** 切换源码 README 图片引用
- [x] **I-S02:** 安全生成不可变 npm README
- [x] **I-S03:** 覆盖源码、生成和发布验证
- [x] **I-S04:** 说明源码与发布候选契约

### Implementation acceptance criteria

- [x] **I-AC01:** 源码图片可预览且外部引用不变
- [x] **I-AC02:** npm README 全部绑定 release commit
- [x] **I-AC03:** 非法相对输入 fail closed
- [x] **I-AC04:** 发布链路验证保持完整

实现证据：中英文源码 README 的主图与 mascot 均改为 canonical
`./assets/...`，外部 badge 与视频 URL 保持不变。npm README 生成器分别将安全
的 Markdown 图片和 HTML `src` 转为完整 release commit 固定的 jsDelivr URL，
将 Markdown 链接和 HTML `href` 转为同一 commit 的 GitHub blob URL，并拒绝
traversal、越界、未知资源位置、非 canonical HTML 属性与 Markdown reference
definition。legacy `@main` jsDelivr 和 raw GitHub 输入继续迁移到不可变 endpoint。

聚焦语法与 unit/contract/integration/release verification 矩阵 29/29 通过。
`silvermoon check --worktree --json` 返回 `project-ready` 且无 problem。
`pnpm check` 通过：unit 74/74、contract 31/31、integration 114 项通过且 2 项
因 Windows symlink 权限按预期跳过、installed-package E2E 1/1；package
contents、Markdown lint 与 canonical skill 同步检查均通过。未创建 release tag，
未执行 npm 发布。

## Deployment

### Deployment steps

- [x] **D-S01:** 核验 GitHub 主分支 README

### Deployment acceptance criteria

- [x] **D-AC01:** 两种语言 README 的项目图片在线可用

部署证据：在 primary commit
`bc996fe08d0a1ef79c823caecb3ccf02d4303578` 上，GitHub 英文仓库页
`https://github.com/shazhou-ww/silvermoon` 与中文 README 页面
`https://github.com/shazhou-ww/silvermoon/blob/main/README.zh-CN.md` 均返回
HTTP 200（`text/html; charset=utf-8`），并渲染 logo 与 mascot。两页解析出的
`https://github.com/shazhou-ww/silvermoon/raw/main/assets/silvermoon.svg` 均返回
HTTP 200（`image/svg+xml`），SHA-256 为
`b60395a15bf57ed2f8e3ae41a7d29681d44b101626690962fa9bd7a802816796`；两页解析出
的 `https://github.com/shazhou-ww/silvermoon/raw/main/assets/silvermoon-mascot.png`
均返回 HTTP 200（`image/png`），SHA-256 为
`aecbc9531d2f6735d843f42de4955613de0943c3b7f3f24cc5cd30afda8e13a8`。两种资源的
响应字节均与该 primary commit 中对应文件完全一致。
