# Implementation

## Steps

### I-S01: 切换源码 README 图片引用

将 `README.md` 与 `README.zh-CN.md` 中项目自有主图和 mascot 图片改为
canonical `./assets/...` 路径，保持两种语言的结构、alt text、显示尺寸以及
外部 badge 和视频绝对 URL 不变。

### I-S02: 安全生成不可变 npm README

扩展 `generate-npm-readme.mjs`，区分 Markdown 图片、HTML `src`、Markdown
普通链接和 HTML `href`。允许的 `./assets/...` 图片转换为绑定完整 release
commit 的 jsDelivr URL；允许的普通仓库链接继续转换为同一 commit 的 GitHub
blob URL。对两类相对引用统一拒绝 traversal、绝对路径、协议相对输入、
非 canonical 路径和无法识别的资源位置，同时保留现有 legacy 主分支资源转换。

### I-S03: 覆盖源码、生成和发布验证

更新 unit、contract、integration 与 release verification 测试，覆盖中英文
README、Markdown 与 HTML 图片语法、文档链接、外部 URL 保留、完整 commit
固定，以及 traversal、越界、未知资源和非 canonical 输入的显式失败。

### I-S04: 说明源码与发布候选契约

更新 npm 发布文档，明确仓库源码 README 使用可在 branch、pull request 和本地
预览的相对图片，而隔离 staging tree 中的 npm README 使用 release commit 固定
的 jsDelivr 图片和 GitHub blob 文档链接；不改变发版授权或执行 npm 发布。

## Acceptance criteria

### I-AC01: 源码图片可预览且外部引用不变

两份仓库 README 的项目图片均使用 `./assets/...`，且不存在项目自有的
`@main` 图片 URL；外部 badge 和视频仍保持原绝对 URL。通过源码契约测试和
README 差异证明。

### I-AC02: npm README 全部绑定 release commit

给定完整 Git object ID，两份生成结果中的允许图片都使用该 commit 的 jsDelivr
URL，普通文档链接使用该 commit 的 GitHub blob URL，且没有相对资源、movable
ref 或其他待改写仓库引用。通过生成器 unit 与 integration 测试证明。

### I-AC03: 非法相对输入 fail closed

包含 `..` traversal、越界路径、绝对路径、非 canonical 形式或未知相对资源位置
的 Markdown 图片、HTML `src`、Markdown 链接与 HTML `href` 都以明确错误终止，
不会被猜测、静默保留或生成发布 URL。通过失败矩阵 unit 测试证明。

### I-AC04: 发布链路验证保持完整

发布 workflow 仍在隔离 staging tree 中生成两份 README，tarball、README
metadata 和发布后 jsDelivr 资源验证继续使用同一候选 commit。聚焦测试、
`silvermoon check --worktree`、`silvermoon check --staged` 与 `pnpm check`
全部通过，且未创建 npm release tag 或执行 npm 发布。
