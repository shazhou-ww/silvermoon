# Deployment

本 idea 的 deployment 只验证仓库候选及真实终端体验，不发布 npm package，
不修改 shell profile，也不记录未获得的用户验收。

## Steps

### D-S01: 发布并锁定验收候选

先发布本 Deployment 契约，重新观察精确 `deploymentRevision`。
确认实现及验收事实已位于配置的 `origin/main`，记录其 commit。
用 `silvermoon check --remote` 验证 primary snapshot，保留
`pnpm check` 对同一实现候选的通过证据；如 primary 同时移动，先
重新观察并确认所验证的候选仍包含本 idea 的实现，不借用旧版证据。

### D-S02: 检查非交互输出和机器报告

在已验证的候选上分别运行 `list-ideas`、无 selector 的
`whats-next` 的 `--audience agent`、非 TTY human 输出，以及
`--json`；核对表头 `Alias / ID`、标题、相对时间、problems 表格、
四投影及精确 UTC 时间戳。验证显式 `--json --audience agent`
按 usage error 退出，检查不产生 TUI 控制序列或隐式交互。
保留命令与结果摘要，不把 trace 或私人终端内容提交到仓库。

### D-S03: 在真实 Windows 终端核对交互体验

在使用者的 PowerShell 终端运行仓库候选的 human TTY
`list-ideas` 和无 selector 的 `whats-next`。先将终端扩至
至少 140 列，再缩至约 80 列：检查中文、框线和末列标题，
宽屏下中文时间与标题不被错误拆行，窄屏仍可滚动浏览。
拖选包含中文的文字并按 `y`，贴出内容核对剪贴板；
成功反馈应暂占原快捷键栏、约三秒消失、正文不跳动。
在没有真实交互终端或使用者未确认时保留此项未完成，
不得以模拟测试代替真实终端观察。

## Acceptance criteria

### D-AC01: 受检候选来自已发布 primary

记录包含实现与 Deployment 契约的 primary commit，
证明该 commit 可从刷新后的 `origin/main` 到达；
`silvermoon check --remote` 返回有效且对应所记录的 primary，
`pnpm check` 对实现候选通过。核对命令输出及 ledger 中的
commit 和结果；不需要 npm 发版或本地 publish。

### D-AC02: 管道、Agent 和 JSON 输出保持可靠

真实 CLI 调用证明 agent 与非 TTY human 为无 ANSI/TUI 的原始 Markdown，
两种 idea 列表同列且有标题，时间为简短相对时间，
problems 为 Markdown 表格；JSON 仍含 `intention`、
`observation`、`actions`、`response` 四投影及未被改写的 UTC
时间戳，显式冲突参数以退出码 2 拒绝。
保存可复现的命令、退出码和无敏感数据的输出摘要。

### D-AC03: 真实 human TTY 体验由使用者确认

使用者在宽、窄两种 Windows PowerShell 终端宽度下确认
Unicode 文本和框线可读，宽终端表格充分利用空间且中文
单元格不被误拆，窄终端可滚动；拖选后按 `y` 可粘贴原文，
复制提示保持一行、约三秒消失且正文不位移。
以使用者对上述步骤的明确反馈作为证据；在反馈前不勾选此项，
也不推断 deployment acceptance。
