# Deployment evidence

## Packaged CLI

- 隔离 device environment 中从当前 checkout 生成并安装
  `silvermoon-0.5.0.tgz`，通过安装产物入口执行 6 组 page/search：
  Device、Project、Idea × `en-US`、`zh-CN`。
- 每组均验证稳定 page ID、locale、双语 Markdown chrome，以及以页面标题搜索后
  返回可导航的同一稳定 ID。
- 查询前后比较隔离 consumer 目录全部文件的 SHA-256 清单，结果完全一致，
  证明 packaged page/search 未写入安装目录。

## 公开示例

- 隔离的全局 runtime 指向当前 checkout，并成功执行 README 的 Project page
  与 Idea search 示例；同时验证 search 无结果响应。
- 额外执行 `problems/repository`、`checks/repository-worktree-clean` 和
  `revision` 搜索，证明 problem 详情、check 说明及搜索结果命令均可继续导航。

## Release-grade

- `pnpm check`：通过；typecheck、构建、Markdown、pure boundary、unit、
  contract、integration、package、installed-package E2E 与 skill discovery
  全部完成。
- package dry-run 验证 `silvermoon@0.5.0` 的 1060 个文件；quick suite
  58 项、installed-package E2E 1 项与其余 release-grade suites 均通过。

这些验证不创建 npm tag、不发布 package，也不变更 dist-tag。
