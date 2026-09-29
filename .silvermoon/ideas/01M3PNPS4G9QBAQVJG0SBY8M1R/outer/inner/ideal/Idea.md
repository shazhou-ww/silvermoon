# README 源文件使用可预览的相对图片

## 意图

让仓库中的中英文 README 使用相对路径引用项目图片，使新建或更新的图片在 feature
branch、pull request 和本地编辑器中可直接预览；npm 发布候选仍自动转换为固定到
release commit 的 jsDelivr 地址。

## 背景

当前 `README.md` 和 `README.zh-CN.md` 使用
`https://cdn.jsdelivr.net/gh/shazhou-ww/silvermoon@main/assets/...` 引用项目图片。
这能让 npm 页面显示图片，但新图片在进入 `main` 并被 CDN 获取前无法从分支 README
中预览，更新图片时也可能继续显示 `main` 上的旧版本。

npm 发布流程已经在隔离 staging tree 中生成 commit-pinned README：
`generate-npm-readme.mjs` 会把普通相对文档链接转换为固定 commit 的 GitHub blob
URL，也会把现有 `@main` 和 legacy raw GitHub 资源地址转换为固定 commit 的
jsDelivr URL。发布校验进一步要求 README 不含 movable ref，并验证固定 commit 的
远端图片内容。

当前生成器会在转换前主动拒绝相对 Markdown 图片和 HTML `src`，因此源码 README
还不能安全使用 `./assets/...`。源码契约测试也明确要求 `@main` 图片地址。

## 期望结果

- 仓库中的中英文 README 对项目自有图片使用 `./assets/...` 相对路径，分支与本地
  预览显示当前 checkout 中的图片，不依赖图片已进入 `main`。
- npm README 生成器把允许的相对 Markdown 图片和 HTML `src` 转换为
  `https://cdn.jsdelivr.net/gh/shazhou-ww/silvermoon@<release-commit>/...`。
- 普通相对文档链接和 HTML `href` 继续转换为固定 commit 的 GitHub blob URL；
  外部 badge、视频和其他绝对 URL 保持不变。
- 生成后的 README 不含相对资源、movable Git ref 或其他未固定的仓库资源引用，
  并继续通过 tarball、README metadata 和发布后远端资源验证。
- 非法、越界或无法识别的相对资源继续 fail closed，而不是被猜测、静默保留或
  生成错误的发布地址。

## 范围

### 范围内

- 将 `README.md` 和 `README.zh-CN.md` 中 Silvermoon 主图及 mascot 图片改为
  repository-relative `./assets/...` 引用。
- 扩展 npm README 生成器，分别处理 Markdown 图片、HTML `src`、普通 Markdown
  链接和 HTML `href`，为资源与文档选择正确的 commit-pinned endpoint。
- 只允许明确安全的仓库内相对资源路径，并拒绝 `..` traversal、绝对路径、协议
  相对地址、非 canonical 形式及其他越界输入。
- 更新源码 README、生成器、集成发布和发布验证相关测试，覆盖中英文 README、
  Markdown/HTML 语法、immutable commit 与失败情形。
- 更新 npm 发布文档，说明源码可预览引用与发布候选 immutable 引用的区别。

### 范围外

- 改变 npm trusted publishing、release tag、版本或 dist-tag 流程。
- 改变外部 badge、npm、CI、视频或第三方网站链接。
- 把所有项目文档复制进 npm tarball，或重写 README 以外文件中的图片。
- 引入图片 CDN、构建服务或运行时网络依赖。
- 发布新的 npm package 版本；本 idea 只修改并验证仓库内容，不执行 npm 发版。

## 约束

- 发布候选图片 URL 必须使用完整 release commit，不得使用 `main`、`HEAD`、tag、
  branch 或短 SHA。
- 图片资源必须使用能直接返回原始内容的 endpoint；GitHub `blob` 页面只能用于
  可点击文档链接，不能作为 `<img src>` 或 Markdown 图片目标。
- 转换必须确定性且不修改仓库中的源 README；相同源文本与 commit 产生相同结果。
- 现有对 legacy raw GitHub 和 `@main` jsDelivr 输入的兼容转换可以保留，但新的
  canonical 源码形式是安全的 repository-relative 资源路径。
- 两份 README 的图片结构和转换行为保持一致，alt text 与现有显示尺寸不回退。
