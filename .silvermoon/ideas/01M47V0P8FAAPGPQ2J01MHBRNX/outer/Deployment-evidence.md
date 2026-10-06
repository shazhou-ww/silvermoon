# TypeScript 改造部署证据

## 候选身份

- Idea：`typescript-strict-refactor`
- Idea ID：`01M47V0P8FAAPGPQ2J01MHBRNX`
- 已验收 Implementation revision：`fdec2b1c5ed37cedbd7e177a660c1aba7bf5e7c8`
- 初始 implementation commit：`2a7dd6c25c1287f2bcbc272314cc5706a115f5e8`
- 部署契约 commit：`a098b37181ff49c0c4d6c100b3160f8d3ba594c1`
- 最终验证候选 commit：`4520133c65bcfba73b2609aff708da18b94ca7f9`

`git merge-base --is-ancestor` 证明上述三个提交均可从刷新后的 `origin/main` 到达；
最终本地分支与 `origin/main` 的 ahead/behind 为 `0/0`。

## 外部 CI

针对 `4520133c65bcfba73b2609aff708da18b94ca7f9` 手动触发 GitHub Actions
`CI` workflow：

- Run：<https://github.com/shazhou-ww/silvermoon/actions/runs/37478506244>
- 结论：`success`
- `Repository contracts`：`success`
- `Select package validation conservatively`：`success`
- Node.js 22 / Ubuntu、Windows、macOS：全部 `success`
- Node.js 24 / Ubuntu、Windows、macOS：全部 `success`
- `Git integration - Node 24 on Ubuntu`：`success`
- `Package contents and installed CLI`：`success`
- `Required checks`：`success`

第一次针对 `a098b37181ff49c0c4d6c100b3160f8d3ba594c1` 的 run
<https://github.com/shazhou-ww/silvermoon/actions/runs/37476388760> 揭示独立
`test:contract` 与 `test:integration` 命令依赖本地残留 `dist`。候选随后改为让两个公开
测试命令先执行可复现构建，并让已完成构建的 release runner 使用明确的 `:built`
入口。从清理后的工作树独立运行两个命令和完整 `pnpm check` 均通过后，才触发并接受
上述成功 run。

成功 run 的 package job 从候选重新构建 tarball，并通过包内容验证和安装后 E2E；
因此 CLI、根导出、Agent 子路径及生成声明不依赖当前工作树的历史构建产物。

## Remote Silvermoon 验证

在刷新 primary 后执行：

```text
node bin/silvermoon.js check --remote --audience agent
```

结果为 `valid: true`，目标 baseline 为
`4520133c65bcfba73b2609aff708da18b94ca7f9`，来源为 `fetched-primary`；
remote snapshot、项目配置和完整 V2 event history 均通过验证。

## 发布边界

- 未创建或移动指向最终候选的 `npm/silvermoon/*` tag。
- 未运行 `npm publish`，未触发 `publish-npm.yml`。
- 未修改 npm registry 或 GitHub Release。
- 正式 npm 版本发布仍需独立版本变更、不可变 release tag 和明确发布授权。
