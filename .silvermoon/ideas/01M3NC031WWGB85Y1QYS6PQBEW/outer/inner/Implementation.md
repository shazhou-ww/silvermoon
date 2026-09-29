# Implementation

## Steps

### I-S01: 建立根级公开资产契约

将主视觉和头像的 canonical SVG 统一到根级 `assets/`。保留仍被历史 README
引用的旧路径兼容副本，明确 package allowlist，并增加安全性、可读性、内容
一致性和路径契约测试。

### I-S02: 生成 commit 固定的 jsDelivr README

将仓库 README 的公开图片地址切换到根级资产的 GitHub-backed jsDelivr URL。
扩展 npm README generator，使发布候选中的可移动 jsDelivr 仓库引用固定到
完整发布提交，并拒绝未处理的 `main`、`HEAD`、相对资源或其他可移动引用。

### I-S03: 构建并发布单一 tarball

重构发布 workflow，在隔离 staging 内容中生成 README，只运行一次实际
`npm pack`，记录 tarball 路径、SHA/integrity 和文件清单。让 package 内容
检查与已安装 E2E 使用该文件，并通过 `npm publish <tarball> --provenance`
发布完全相同的文件。

### I-S04: 加强发布编排与外部核验

保持 `origin/main` ancestry 和受保护标签检查，更新发布 planner、发布后核验
工具、仓库专用 publish skill 与维护文档。核验 npm 版本、dist-tag、registry
integrity、tarball README、包级 README、provenance 和 jsDelivr 资源响应，
并对注册表内容与候选不一致显式报错。

### I-S05: 覆盖发布合同并完成仓库验证

为 URL 改写、兼容资产、单一 tarball 数据流、main ancestry、workflow 顺序和
发布 skill 增加单元、契约、集成与安装后覆盖。运行 release-grade 检查、
skill 检查、Markdown 检查、包内容检查和 Git diff 检查。

## Acceptance criteria

### I-AC01: 公开资产路径一致且向后兼容

仓库和 npm package 中的 canonical 主视觉与头像都位于根级 `assets/`，历史
README 使用的兼容路径仍可读取相同字节。通过文件内容断言、SVG 安全与对比度
测试、package allowlist 以及 README 契约测试证明。

### I-AC02: 发布 README 只引用不可变资源

给定完整发布提交，generator 确定性地产生指向该提交下根级资产的 jsDelivr
URL，且结果中不存在 `@main`、`HEAD`、未处理相对资源或可移动 GitHub 资源
引用。通过聚焦单元测试、真实 README 集成测试和生成结果断言证明，源 README
在生成前后保持字节不变。

### I-AC03: 验证与发布使用同一 tarball

workflow 只创建一个实际发布 tarball，package 文件检查和安装后 E2E 都消费
该文件，最终 `npm publish` 接收同一路径。通过 workflow 契约测试、tarball
SHA/integrity 记录和不会再次从目录打包的命令形状证明。

### I-AC04: 主分支发布信任边界保持不变

发布 planner、workflow 与 publish skill 继续拒绝不在刷新后 `origin/main`
上的候选，并只允许不可变 `npm/<release-key>/v<version>` 标签触发 trusted
publishing。通过 ancestry 单元/集成测试、workflow 契约和 skill 文本契约
证明，不引入 off-main 发布例外。

### I-AC05: 完整候选通过 release-grade 验证

实现候选通过 `pnpm check`、`pnpm check:skills`、Markdown lint、包内容与安装
后测试、`git diff --check` 和 `silvermoon check --worktree`。检查输出必须
证明没有无关 CLI、schema 或 lifecycle 行为变化。
