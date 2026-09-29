# 稳定公开资产与 npm 单一发布产物

## 意图

为 Silvermoon 建立一致、长期稳定的公开资产契约，并让每个 npm 版本都从
`origin/main` 上的不可变标签确定性地产生一份经过验证的发布产物。发布过程
不制造脱离主分支的 release commit，README 中面向版本的资产引用固定到精确
Git 提交，测试与发布使用同一个 tarball。

## 背景

Silvermoon 的主视觉目前位于根级 `assets/`，头像位于 `docs/assets/`。两者都
承担项目品牌、仓库 README 和 npm 软件包页面的公开展示职责，仅按“文档附件”
划分目录并不能准确表达其用途。历史 npm README 又分别引用了这两个路径，
直接移动或删除任一路径都会破坏已经发布的页面和外部链接。

当前受保护发布 workflow 已在打包前把 README 中指向 `main` 的 GitHub 资源
地址改写为发布提交，但 package 检查、安装测试和最终发布仍可能分别触发打包。
实际发布的 `silvermoon@0.1.0` tarball 已包含固定到提交的 README，npm 注册表
的包级 README 元数据却仍保留指向 `main` 的地址，说明现有验证还不能证明
测试产物、发布产物和注册表展示使用了同一份内容。

为每个版本创建脱离 `main` 的 release commit 会削弱现有 ancestry 信任边界，
还会产生“提交内容无法引用自身提交 ID”的循环。更可靠的边界是继续只给
`origin/main` 可达提交打标签，由 workflow 在临时 staging 内容中生成特定
版本的 README，再一次性打包、验证并发布该 tarball。

## 期望结果

根级 `assets/` 成为 Silvermoon 公开品牌资源的 canonical location，主视觉和
头像通过 GitHub-backed jsDelivr URL 提供；面向已发布版本的 URL 使用完整
Git 提交 ID，不依赖 `main`、`HEAD` 或其他可移动引用。已有公开路径继续提供
兼容内容，不因 canonical location 调整而断开。

每次 npm 发布仍由 `origin/main` 可达提交上的受保护
`npm/silvermoon/v<version>` 标签触发。workflow 在隔离的 staging 内容中生成
版本 README，只创建一次 tarball，并对这同一文件完成内容检查、安装测试、
provenance 发布和注册表核验。仓库源码和标签不包含仅为发布生成的 off-main
commit，发布 skill、脚本、文档与自动化测试共同强制该契约。

## 范围

### 范围内

- 将主视觉和头像的 canonical 文件统一到根级 `assets/`，定义并验证旧路径的
  兼容策略。
- 使用 jsDelivr 的 GitHub endpoint 提供公开 SVG，并将发布 README 中的资源
  URL 确定性地固定到完整发布提交。
- 在隔离的 staging 内容中生成 npm README，不改写被标签指向的 Git 提交。
- 一次生成 npm tarball，对同一文件执行 allowlist 检查、安装后 E2E、发布与
  完整性核验。
- 保持并加强 `origin/main` ancestry、不可变标签、GitHub Actions OIDC
  trusted publishing 和 provenance 边界。
- 更新 release generator、workflow、package 检查、自动化测试、发布文档和
  仓库专用 publish skill，并验证 npm 包级 README 与 tarball README。
- 在下一次获得明确版本授权的发布中证明端到端外部结果。

### 范围外

- 修改或重新发布已经存在的 npm 版本及其不可变 tarball。
- 让未合并的 release branch、未发布的本地提交或其他 off-main commit 成为
  npm 发布来源。
- 本地运行 `npm publish`、引入 npm 写入令牌，或绕过 GitHub environment、
  tag ruleset 与 trusted publisher。
- 建设自有域名、对象存储、通用图片托管服务或与公开资产无关的 CDN 基础设施。
- 无关的 CLI、schema、idea lifecycle 或仓库模型行为变更。

## 约束

- 根级 `assets/` 是 canonical source；为旧 URL 保留的兼容文件必须与 canonical
  文件字节一致，且不得通过不可靠的符号链接或外部 SVG 引用实现。
- 发布 README 中的 jsDelivr GitHub URL 必须包含完整 Git object ID；生成结果
  不得残留 `@main`、`HEAD` 或其他可移动仓库引用。
- 发布标签必须保持不可变并指向刷新后的 `origin/main` 可达提交；不得为了
  README URL 创建、推送或标记 off-main release commit。
- README 改写必须确定、fail-closed 且不依赖下载远端内容；输入提交、路径或
  URL 形状不合法时必须在发布前显式失败。
- workflow 必须发布经过内容检查和安装测试的同一个 tarball，并通过 registry
  integrity、包级 README、tarball README、dist-tag 和 provenance 证明结果。
- npm 包继续携带 SVG 文件；CDN 是公开展示层，不得成为已安装软件包获取资源
  的运行时依赖。
- 发布 skill 只负责安全编排和验证；关键约束必须由脚本、workflow 与测试
  强制执行，不能只依赖提示词约定。
