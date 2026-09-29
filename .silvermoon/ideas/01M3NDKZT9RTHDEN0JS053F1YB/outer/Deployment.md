# Deployment

本 idea 的 Outer World 以 configured primary 上可审阅的已验收实现、部署契约和
托管 CI 证据为完成边界。它不要求新的 package version、npm registry artifact
或 release；部署过程不得创建 npm release tag，也不得触发 npm 发布 workflow。

## Steps

### D-S01: 发布无发版部署契约

将本部署契约以普通 non-force commit 发布到 configured primary，保持已经验收的
Inner World 与 Ideal World 不变。发布后重新运行
`silvermoon whats-next list-ideas --json`，取得稳定的 `deploymentRevision`；
后续外部验证只针对承载该 revision 的精确 primary commit。

### D-S02: 验证精确 primary commit 的托管 CI

等待 GitHub Actions 对承载稳定 `deploymentRevision` 的精确 primary commit
完成 CI。通过 GitHub run metadata 核对 workflow、head SHA、完成状态、结论和
URL；本地测试结果不能替代该外部证据。若 primary 或部署契约发生变化，停止并
重新观测，不得把旧 run 的成功套用到新 revision。

### D-S03: 复核无发版交付边界与 Silvermoon 导航

确认 configured primary 包含已验收 implementation、implementation acceptance
fact 和本部署契约，且本次 deployment 没有修改 package version 或 release
workflow、没有创建 npm release tag、没有触发 npm 发布。在 clean、与 primary
对齐的 checkout 上重新运行 `whats-next --json`，确认 idea 仍处于 deploying，
返回的 `deploymentRevision` 与验证目标一致，再记录 ledger 证据并请求用户验收。

## Acceptance criteria

### D-AC01: 已验收实现与部署契约存在于 configured primary

configured primary 必须包含 implementation commit
`ec633e3aeea87c6cb7fa042a18d29b9ff279bba0`、记录 implementation acceptance
的 commit `6531da416b7e6203873d8d001726263094e7d3f1`，以及承载稳定
`deploymentRevision` 的部署契约 commit。通过 fresh remote tip 和 Git ancestry
对精确 commits 核验；不得依赖陈旧 remote-tracking ref，也不得 force-push。

### D-AC02: 精确部署候选的 GitHub Actions CI 成功

GitHub Actions `CI` workflow 必须在承载稳定 `deploymentRevision` 的精确
primary commit 上以 `completed/success` 结束。通过 `gh run view` 核验 head SHA、
status、conclusion、URL 和 jobs，并记录可访问的 run URL 作为外部证据。

### D-AC03: deployment 不产生 release artifact 或发布动作

从 implementation acceptance commit 到部署证据 commit 不得修改 package
version、npm release workflow 或其他产品 deliverable。本任务不得创建
`npm/silvermoon/v*` tag，不得 dispatch `publish-npm.yml`，也不得执行本地 npm
publish。通过精确 commit diff、remote refs 和 GitHub Actions run metadata
证明。

### D-AC04: 发布后导航与 deployment revision 一致

在 primary 对齐且 worktree clean 时，`silvermoon whats-next list-ideas --json`
必须返回空 `problems`、成功的 `fetch-primary` action 和 `deploying` lifecycle
instructions；其中要求用户验收的 `deploymentRevision` 必须与 D-AC02 验证的
部署契约一致。保存 exact revision 与 primary commit 作为证明。
