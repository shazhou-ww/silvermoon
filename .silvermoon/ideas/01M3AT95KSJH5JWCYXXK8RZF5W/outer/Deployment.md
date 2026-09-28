# Deployment

## Steps

### D-S01: 发布部署契约

将本部署契约以普通 commit 发布到 configured primary，保持已经验收的 Inner
World 与 Ideal World 不变。发布后重新运行
`silvermoon whats-next 01M3AT95KSJH5JWCYXXK8RZF5W --json`，取得稳定的
`deploymentRevision`，后续外部验证只针对承载该 revision 的精确 primary commit。
本 idea 不改变 package version，因此不创建 npm release tag，也不触发 npm 发布。

### D-S02: 验证精确 primary commit 的托管 CI

等待 GitHub Actions 对承载稳定 `deploymentRevision` 的精确 primary commit 完成
CI。通过 GitHub run metadata 核对 workflow、head SHA、完成状态、结论和 URL；
本地测试结果不能替代该外部证据。若 primary 或部署契约发生变化，停止并重新观测，
不得把旧 run 的成功套用到新 revision。

### D-S03: 复核发布后的 Silvermoon 导航

在 clean、与 configured primary 对齐的 checkout 上，再次对本 idea 运行
`whats-next --json`。确认 fetch 成功、observation 无 problems、idea 仍处于
`deploying`，并且返回的 `deploymentRevision` 与本次验证目标一致；随后记录 ledger
证据并请求用户验收该精确 revision。

## Acceptance criteria

### D-AC01: 已验收实现与部署契约存在于 configured primary

configured primary 的 tip 必须包含 implementation commit
`940b31dfae211a003aa13e6a36355abf03b52464`、记录 implementation acceptance 的
status commit，以及本部署契约。通过 `git ls-remote origin refs/heads/main` 与
`git merge-base --is-ancestor` 对精确 commit 核验；不得依赖陈旧 remote-tracking
ref，也不得 force-push。

### D-AC02: 精确部署候选的 GitHub Actions CI 成功

GitHub Actions `CI` workflow 必须在承载稳定 `deploymentRevision` 的精确 primary
commit 上以 `completed/success` 结束。通过 `gh run view <run-id> --json
headSha,status,conclusion,url,jobs` 核验 head SHA 和所有 jobs；记录可访问的 run URL
作为外部证据。

### D-AC03: 发布后导航与部署 revision 一致

在 primary 对齐且 worktree clean 时，
`silvermoon whats-next 01M3AT95KSJH5JWCYXXK8RZF5W --json` 必须返回
`task-pending`、空 `problems`、成功的 `fetch-primary` outcome 和
`deploying` lifecycle instructions；其中要求用户验收的 `deploymentRevision`
必须与 D-AC02 验证的部署契约一致。保存命令结果中的 revision 与 primary commit
作为证明。
