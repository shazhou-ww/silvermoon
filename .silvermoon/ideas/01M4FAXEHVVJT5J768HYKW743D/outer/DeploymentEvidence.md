# Deployment Evidence

## 发布 hold

按 2026-10-09 的明确决定，`0.4.0` 只完成发布前验证，不执行发布：

- `git ls-remote --tags origin refs/tags/npm/silvermoon/v0.4.0` 返回空结果，
  证明 release tag 不存在。
- `gh run list` 对 `publish-npm.yml` 和 `npm/silvermoon/v0.4.0` branch 的查询
  返回 `[]`，证明该 tag 未触发发布 workflow。
- `npm view silvermoon@0.4.0 version --json` 返回 `E404`，证明 registry 中没有
  `silvermoon@0.4.0`。
- 未创建 GitHub Release，未执行 `npm publish`。后续发布需要新的明确授权并重新
  验证当时的完整身份链。

## 候选验证

`pnpm check` 在 `0.4.0` worktree 候选上退出 `0`，其中：

- package contract 返回
  `PACK_OK name=silvermoon version=0.4.0 files=533`；
- installed-package E2E 返回
  `PACK_SMOKE_OK name=silvermoon version=0.4.0`；
- canonical skill 同步与 discovery 检查通过；
- personal discovery link fixture 在不读取项目的情况下通过；
- current、受支持历史和 future schema fixtures 全部通过；
- 历史项目通过真实 `project-v1-to-v2` plan/apply，future schema 的三种 runtime
  freshness 结果保持可区分。

installed-package E2E 的普通项目没有 `package.json`、`node_modules` 或
repository `.agents` 目录，runtime 从项目外的已安装 package 执行。该证明与
[device readiness tests](../../../../test/runtime/device-readiness.test.ts)、
[schema readiness tests](../../../../test/integration/schema-readiness.test.ts)
和 [installed-package smoke](../../../../test/e2e/installed-package.test.ts)
共同覆盖设备与项目边界。

remote/cloud Agent 不能借用开发机安装，必须在自己的执行环境 provision runtime
与 personal skill；该边界保留在
[Getting Started](../../../../docs/getting-started.md) 和
[Silvermoon adoption](../../../../skills/silvermoon/references/adoption.md)。
本次没有把文档边界表述为已执行的 cloud deployment。
