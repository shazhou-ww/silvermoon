# Deployment

## Steps

### D-S01: 固化并同步部署验证契约

将本契约和匹配 ledger 同步到 primary，重新观察准确 deploymentRevision。
部署对象是已接受 implementationRevision
`63d40f0b0a1f63ad4ea5619860996678bfb117ad`，实现 commit 为
`52f068d30452e827de35a1afe8356d84779adbb3`，接受决定 commit 为
`53233e97e8b53e882c2611774ae7774321ec27de`。本阶段只更新 Outer World
契约、证据与 ledger，不修改已接受的 repository deliverables，不发布 npm、不重写
Git 历史，也不隐式迁移外部 checkout。

### D-S02: 审计准确 primary 的单文件权威

刷新 primary，确认实现和接受决定均可达。使用 committed Git tree 检查全部 idea
的根目录 regular-file `events.jsonl`、不存在旧 `events/` segments、配置仍为
`version: 2`，并运行源仓库入口的 `check --remote --audience agent`。
对本 idea 完整 replay，确认 acceptInner 记录绑定上述准确 revision，并验证 history。
将准确 primary commit、布局数量、receipt 与命令结果记录于同世界部署证据。

### D-S03: 验证 hosted CI 并同步部署证据

通过现有 CI workflow 验证包含已接受实现和部署契约的准确 primary commit。
若尚无该 commit 的 CI run，则对 primary 显式 dispatch 现有 workflow；记录 run URL、
head SHA、跨 Windows/Linux/macOS 与 Node 22/24 的矩阵、integration、package/
installed-package 以及 Required checks 结果。运行未完成时等待外部结果，不把 queued、
skipped 或局部通过当作整体成功。
全部验证通过后固化 DeploymentEvidence.md、更新 ledger，验证并同步到 primary。
重新观察最终 deploymentRevision，再请求该准确 revision 的 acceptOuter。

## Acceptance criteria

### D-AC01: 已接受实现与部署契约存在于 primary

部署契约已经同步且有准确 revision，实现与 acceptInner commit 均从刷新后的 primary
可达。通过 Git ancestry、源仓库 whats-next 与部署证据证明；不改变 inner revision，
也不以同步代替 acceptOuter。

### D-AC02: 远端单文件布局与事件历史有效

准确 primary 的所有 V2 ideas 只使用 regular-file `events.jsonl`，没有旧 segment
路径，配置保持 V2；remote snapshot/history check 成功。本 idea replay 保留已有
alias、acceptIdeal 与准确 acceptInner，sequence 连续，事件 digest 为完整文件 blob
OID。通过 Git tree 审计、remote check 和 replay receipt 证明。

### D-AC03: Hosted CI 完整通过且最终证据可审阅

记录的 CI run head SHA 是包含已接受实现和部署契约的准确 primary commit；
跨平台矩阵、integration、package/installed-package 与 Required checks 全部成功。
最终部署证据与 ledger 已验证并同步，可通过 commit-pinned links 审阅。
本 idea 不发布 npm，不宣称外部 checkout 已迁移；最终完成仍要求显式 acceptOuter。
