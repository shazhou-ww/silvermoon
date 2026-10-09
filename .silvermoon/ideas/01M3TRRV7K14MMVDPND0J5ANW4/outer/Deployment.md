# Deployment

## Steps

### D-S01: 固定 primary 部署对象

将本部署契约同步到 configured primary，并重新观察稳定的
`deploymentRevision`。证明已接受的 `implementationRevision`
`78328ef4b60c054c529227ca8076cf5ce4af8c63` 及其状态提交均可从刷新后的
`origin/main` 到达；本次部署对象仅为 GitHub 主分支源码，不创建 npm release。

### D-S02: 执行托管 CI 验证

在契约同步后对 `main` 手动触发完整 `CI` workflow，核对实际 `headSha`
包含本部署契约，并等待全部 required jobs 完成。验证范围包括 Node 22/24
跨平台 unit matrix、contract、integration、package/pack 和 installed-package
检查。

### D-S03: 固化外部结果

将 workflow run 的不可变 URL、实际 commit、最终结论及未触发 npm 发布的
边界记录到同世界部署证据。同步证据和 ledger 到 primary，重新观察最终
`deploymentRevision` 后请求 `acceptOuter`。

## Acceptance criteria

### D-AC01: 部署对象已进入 primary

刷新远端后，部署契约、已接受实现及状态提交均可从 `origin/main` 到达；
以 exact commit、`deploymentRevision` 和 commit-pinned repository links
证明。

结果：已验证实现提交 `6cf32dcab6281765b247a284afec84525443e458`、
状态提交 `a3be4f929230f5771614ed98028ae15f403afaa4` 与部署契约提交
`0968846329bf726d0f8eb65a34b47e9869ede669` 均可从刷新后的
`origin/main` 到达。被测契约 revision 为
`1acdbeb54af072cafb7653ead2e20505e587b712`。

### D-AC02: 托管 CI 对部署对象全部通过

一次 `workflow_dispatch` CI run 的 `headSha` 包含稳定部署契约，run 结论为
`success`，且所有 required jobs 均成功；以固定 GitHub Actions run URL
和 job 列表证明。

结果：[CI run 37878421830](https://github.com/shazhou-ww/silvermoon/actions/runs/37878421830)
以 `workflow_dispatch` 验证 commit
`0968846329bf726d0f8eb65a34b47e9869ede669`，最终结论为 `success`；
固定 job 链接见 [deployment-evidence.md](./deployment-evidence.md)。

### D-AC03: 部署证据完整且未越过发布边界

Outer World 证据记录 primary commit、CI run、检查结论及本次未创建 npm tag、
release 或 publish workflow；证据、契约和 ledger 均已同步到 primary，
并通过 Silvermoon snapshot validation。

结果：Outer World 证据提交
`7ca10b4dccdc324dbb165be39574539334a7f409` 已可从刷新后的
`origin/main` 到达；worktree 与 staged Silvermoon snapshot validation
均通过。被测 commit 的 publish workflow run 和 npm release tag 数量均为
0，本次未创建 GitHub Release 或执行 npm publish。
