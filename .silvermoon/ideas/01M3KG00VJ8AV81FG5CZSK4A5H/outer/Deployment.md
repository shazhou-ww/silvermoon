# Deployment

## Steps

### D-S01: Establish the exact primary deployment

将本 Outer World contract 通过普通 non-force Git 发布到 configured primary，并重新
观测稳定的 deployment revision。确认 implementation commit 与 implementation
acceptance commit 都是该 primary tip 的 ancestors，不用本地 branch 状态代替远端
事实。

### D-S02: Verify behavior from a clean clone

在独立的新 clone 中 checkout 精确 deployment commit，使用 lockfile 安装依赖，并
运行 snapshot-only 的 targeted integration tests 与 `silvermoon check --remote`。
验证命令必须使用 clone 内的已发布代码和真实 configured primary，而不是当前
worktree 的未发布内容。

本改动只部署 source behavior 到 primary；不改变 package version，不创建
`npm/silvermoon/v*` tag，也不触发 npm publish workflow。

## Acceptance criteria

### D-AC01: Primary contains the accepted implementation

Configured primary 的精确 tip 必须包含 snapshot-only implementation 与其 acceptance
status commit。通过 `git ls-remote` 读取远端 tip，并在 clean clone 中用
`git merge-base --is-ancestor` 对两个 commit 作证明。

### D-AC02: Published source reproduces snapshot-only validation

Clean clone 在精确 deployment commit 上必须通过
`test/integration/check-v1.test.js`、`idea-layout.test.js` 与 `git.test.js`，且
`node bin/silvermoon.js check --remote` 返回 project-ready。测试输出和命令结果作为
ledger evidence；任何依赖安装、fetch、target resolution 或 validation failure 都
阻塞 deployment acceptance。
