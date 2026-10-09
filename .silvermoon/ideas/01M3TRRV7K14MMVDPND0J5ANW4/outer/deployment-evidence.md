# 部署证据

本文件服务于 Deployment 的 D-S01 至 D-S03 及 D-AC01 至 D-AC03，
不是独立契约。

## 部署对象

- 已接受的 `implementationRevision`：
  `78328ef4b60c054c529227ca8076cf5ce4af8c63`。
- 实现提交：
  [`6cf32dcab6281765b247a284afec84525443e458`](https://github.com/shazhou-ww/silvermoon/commit/6cf32dcab6281765b247a284afec84525443e458)。
- `acceptInner` 状态提交：
  [`a3be4f929230f5771614ed98028ae15f403afaa4`](https://github.com/shazhou-ww/silvermoon/commit/a3be4f929230f5771614ed98028ae15f403afaa4)。
- 被测部署契约 revision：
  `1acdbeb54af072cafb7653ead2e20505e587b712`。
- 被测 primary commit：
  [`0968846329bf726d0f8eb65a34b47e9869ede669`](https://github.com/shazhou-ww/silvermoon/commit/0968846329bf726d0f8eb65a34b47e9869ede669)。

2026-10-09 刷新 `origin/main` 后，以上三个 commit 均通过
`git merge-base --is-ancestor <commit> origin/main` 验证。

## 托管 CI

[CI run 37878421830](https://github.com/shazhou-ww/silvermoon/actions/runs/37878421830)
于 2026-10-09T03:15:16Z 由 `workflow_dispatch` 触发，实际 `headSha` 为
`0968846329bf726d0f8eb65a34b47e9869ede669`，于
2026-10-09T03:19:10Z 完成，最终结论为 `success`。

全部 job 均为 `success`：

- [Repository contracts](https://github.com/shazhou-ww/silvermoon/actions/runs/37878421830/job/113652231723)；
- [Unit - Node 22 on ubuntu-latest](https://github.com/shazhou-ww/silvermoon/actions/runs/37878421830/job/113652231970)；
- [Unit - Node 22 on macos-latest](https://github.com/shazhou-ww/silvermoon/actions/runs/37878421830/job/113652231979)；
- [Unit - Node 24 on windows-latest](https://github.com/shazhou-ww/silvermoon/actions/runs/37878421830/job/113652231986)；
- [Unit - Node 24 on macos-latest](https://github.com/shazhou-ww/silvermoon/actions/runs/37878421830/job/113652232002)；
- [Git integration - Node 24 on Ubuntu](https://github.com/shazhou-ww/silvermoon/actions/runs/37878421830/job/113652232008)；
- [Select package validation conservatively](https://github.com/shazhou-ww/silvermoon/actions/runs/37878421830/job/113652232015)；
- [Unit - Node 22 on windows-latest](https://github.com/shazhou-ww/silvermoon/actions/runs/37878421830/job/113652232021)；
- [Unit - Node 24 on ubuntu-latest](https://github.com/shazhou-ww/silvermoon/actions/runs/37878421830/job/113652232091)；
- [Package contents and installed CLI](https://github.com/shazhou-ww/silvermoon/actions/runs/37878421830/job/113652271082)；
- [Required checks](https://github.com/shazhou-ww/silvermoon/actions/runs/37878421830/job/113653160032)。

## 发布边界

本次仅交付 GitHub 主分支源码，不发布 npm 包。验证时：

- commit `0968846329bf726d0f8eb65a34b47e9869ede669` 对应的
  `publish-npm.yml` workflow run 数量为 0；
- 指向该 commit 的 `npm/silvermoon/v*` tag 数量为 0；
- 未创建 npm tag、GitHub Release，未触发 publish workflow，也未在本地
  执行 npm publish。
