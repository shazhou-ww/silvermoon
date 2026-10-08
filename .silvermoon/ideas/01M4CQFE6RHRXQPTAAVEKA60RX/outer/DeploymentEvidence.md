# 单文件事件日志部署验证证据

本文件服务于 [Deployment](./Deployment.md)。部署结果是 Silvermoon 源仓库
primary 上的单文件 V2 authority 和可用运行时，不是 npm 发布或外部仓库迁移。
最终 deploymentRevision 由证据同步后的 whats-next 提供，不在 world tree 中自引用。

## 准确候选与阶段边界

- Idea: `single-event-log` / `01M4CQFE6RHRXQPTAAVEKA60RX`
- 已接受 implementationRevision:
  `63d40f0b0a1f63ad4ea5619860996678bfb117ad`
- 实现 commit: `52f068d30452e827de35a1afe8356d84779adbb3`
- 显式 acceptInner commit: `53233e97e8b53e882c2611774ae7774321ec27de`
- 部署契约与验证 baseline:
  `3746a8a97b637f247ef2b5171a7033eb820f155d`
- 契约同步后观察到的 deploymentRevision:
  `bfcc8b97b3690e6fe9aeaf67815b66a4c76c0084`
- 验证日期: 2026-10-08

Git ancestry 确认实现和接受决定均从刷新后的 primary 可达。部署阶段没有修改
Inner World、runtime、schema、tests、skills 或 package inputs，也没有创建 npm
release tag、执行 publish 或迁移外部 checkout。本证据加入后 Outer World revision
会变化，不能对上面的 baseline revision 直接记录最终 acceptOuter。

## Primary authority 审计

对准确 baseline 的 committed tree 执行 `git ls-tree -r origin/main --
.silvermoon/ideas`，按 idea ULID 枚举并验证 regular-file mode 与日志路径：

```text
PRIMARY_LAYOUT_OK ideas=45 regularEventFiles=45 segments=0
```

配置通过 `git show origin/main:.silvermoon/config.yaml` 读回，仍为 `version: 2`；
primary repository 与 branch 分别为 `https://github.com/shazhou-ww/silvermoon.git`
和 `main`。没有通过 filesystem cache 或本地未提交候选替代 remote authority。

源仓库入口的完整 replay 返回：

| 字段 | 准确值 |
| --- | --- |
| outcome | `observed` |
| length | `295` bytes |
| digest | `a8833e0c2c92bf675e6dc0c17862b1d7b2e1f413` |
| sequence | `3` |
| alias | `single-event-log` |
| approvedRevision | `0cfbf9b287724e012317c7421b957c8bf1221c1f` |
| implementationAcceptedRevision | `63d40f0b0a1f63ad4ea5619860996678bfb117ad` |
| format / reduction | 均为 `ok: true` |

digest 是完整日志的 Git blob OID；事件前缀、连续 sequence 与显式接受记录仍完整。
replay receipt 的 tracking baseline 本身标记 `not-fetched`，远端新鲜度由此前
whats-next/fetch 和下列独立 remote check 提供，不夸大 replay 的网络保证。

## Hosted CI

通过现有 CI workflow 的 `workflow_dispatch` 对 main 触发验证：

- [CI run 37746594938](https://github.com/shazhou-ww/silvermoon/actions/runs/37746594938)
- head SHA: `3746a8a97b637f247ef2b5171a7033eb820f155d`
- status: `completed`
- conclusion: `success`

| Job | Job ID | 结果 |
| --- | --- | --- |
| Git integration - Node 24 on Ubuntu | `113209430772` | success |
| Select package validation conservatively | `113209430857` | success |
| Unit - Node 22 on macos-latest | `113209430932` | success |
| Repository contracts | `113209431004` | success |
| Unit - Node 24 on macos-latest | `113209431054` | success |
| Unit - Node 24 on windows-latest | `113209431089` | success |
| Unit - Node 24 on ubuntu-latest | `113209431094` | success |
| Unit - Node 22 on windows-latest | `113209431139` | success |
| Unit - Node 22 on ubuntu-latest | `113209431181` | success |
| Package contents and installed CLI | `113209470906` | success |
| Required checks | `113211005064` | success |

六组平台/Node 矩阵均实际执行。manual dispatch 选择完整 package validation，
package/installed CLI job 未被风险筛选跳过。run 成功证明该准确 baseline 的 hosted
结果；后续只添加部署证据与 ledger 的 commit 不被冒充为该 run head SHA。

## 实际验证命令与结果

| 命令 | 结果 | 证明范围 |
| --- | --- | --- |
| `node bin\silvermoon.js check --worktree --audience agent` | exit 0 | 部署契约候选有效 |
| `node bin\silvermoon.js check --staged --audience agent` | exit 0 | 部署契约 staged snapshot 有效 |
| `pnpm check:commit` | exit 0 | 部署契约 commit-tier gate 通过 |
| `git diff --cached --check` | exit 0 | 部署契约无 whitespace error |
| `node bin\silvermoon.js whats-next 01M4CQFE6RHRXQPTAAVEKA60RX --audience agent` | exit 0 | 契约同步后为 deploying，并返回准确 baseline deploymentRevision |
| `node bin\silvermoon.js check --remote --audience agent` | exit 0 | fetched primary `3746a8a97b637f247ef2b5171a7033eb820f155d` snapshot/history 有效 |
| `node bin\silvermoon.js event replay 01M4CQFE6RHRXQPTAAVEKA60RX --audience agent` | exit 0 | 完整 canonical log 与准确 acceptInner 有效 |
| `gh workflow run ci.yml --repo shazhou-ww/silvermoon --ref main` | exit 0 | 创建上述准确 baseline CI run |
| `gh run watch 37746594938 --repo shazhou-ww/silvermoon --exit-status --interval 30` | exit 0 | 完整 run 成功终结 |
| `gh run view 37746594938 --repo shazhou-ww/silvermoon --json headSha,status,conclusion,url,jobs` | exit 0 | head SHA 与全部 job success 读回 |

## Stable-ID evidence

- `D-S01` / `D-AC01`: 契约已先同步，再观察其准确 revision；实现与决定均在 primary。
- `D-S02` / `D-AC02`: 45-idea committed layout、V2 config、remote history check
  与本 idea 的完整 replay 均通过。
- `D-S03` / `D-AC03`: 准确 baseline hosted CI 的全部 job 成功；证据与 ledger
  作为最终 Outer World candidate 验证并同步，不修改已接受实现。

最终候选仍需显式 acceptOuter。勾选 ledger、CI 成功或 Git 同步均不构成人工决定。
