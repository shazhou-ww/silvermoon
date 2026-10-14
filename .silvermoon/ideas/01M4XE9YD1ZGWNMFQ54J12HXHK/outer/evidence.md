# Deployment evidence

## Package 与 API

- `pnpm test:contract`：通过，58 项 contract 测试确认公开 schema、Objective Guide
  资源和文档链接契约。
- `pnpm pack:check`：通过，目录 dry-run 生成的 `silvermoon@0.5.0` package
  包含 1056 个受检文件。
- `pnpm test:e2e`：通过，installed-package 场景从打包、安装到公开命令调用全程成功。

## Release-grade

- `pnpm check`：通过；typecheck、构建、Markdown、边界、unit、contract、
  integration、package、installed-package E2E 与 skill discovery 全部完成。

这些命令只验证候选，不创建 npm tag、不发布 package，也不变更 dist-tag。
