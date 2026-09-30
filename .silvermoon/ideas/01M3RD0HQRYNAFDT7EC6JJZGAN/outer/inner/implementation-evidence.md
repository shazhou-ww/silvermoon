# Implementation evidence

本文档服务于 `Implementation.md`，记录 repository candidate 的可复核事实。外部
GitHub settings 与 npm/GitHub Release 结果属于 Deployment evidence，不在此提前宣告
完成。

## Candidate identity

- Idea: `open-source-readiness`
- ULID: `01M3RD0HQRYNAFDT7EC6JJZGAN`
- Approved ideal revision: `60a2529ae01a724a84346f1a8fd9a3218677302e`
- Approved baseline commit: `34637d322fdbc9004d0cb56378beccbab78bf627`
- Community baseline commit: `177c89ba0bab7f2d18e94e936208703cc34d4fb8`
- Implementation candidate commit: 待验证后记录
- Implementation revision: 待同步到 primary 后记录

## Stable-ID evidence

| Stable ID | Repository evidence | Verification | 状态 |
| --- | --- | --- | --- |
| `I-AC01` | `Implementation.md`、`open-source-contract.md`、本文件与 `ledger.md` | Silvermoon snapshot 与 candidate diff | 待验证 |
| `I-AC02` | `.github/dependabot.yml` 与外部 settings 应用协议 | open-source readiness contract test | 待实现 |
| `I-AC03` | `.github/rulesets/main.json` 与 CI `Required checks` | workflow/ruleset contract test | 待实现 |
| `I-AC04` | 全部 workflow `uses` SHA pin 与 Actions update entry | 全 workflow scan | 待实现 |
| `I-AC05` | `package.json` 与双语 README API contract | manifest/doc tests、pack check | 待实现 |
| `I-AC06` | `CHANGELOG.md` 与 `0.3.0` GitHub Release notes | release artifact contract 与 tag observation | 待实现 |
| `I-AC07` | 定向、sanity、release-grade 与 Silvermoon validations | 下方命令证据 | 待验证 |

## Validation results

候选实现完成后记录每条命令、UTC 时间、exit code 与关键成功输出。失败尝试同样保留，
直到根因修复并重新验证。

| 命令 | 结果 | 关键证据 |
| --- | --- | --- |
| 定向 contract tests | 待运行 | - |
| `pnpm check:sanity` | 待运行 | - |
| `pnpm check` | 待运行 | - |
| `silvermoon check --worktree --audience agent` | 待运行 | - |
| `silvermoon check --staged --audience agent` | 待运行 | - |

## External handoff

Implementation acceptance 后，Deployment 必须重新观察外部状态并按
`open-source-contract.md` 执行。当前 implementation evidence 不代表已经启用
private vulnerability reporting、Dependabot security updates、CodeQL default
setup 或 `main` ruleset，也不代表已经创建 `0.3.0` tag、GitHub Release 或 npm
publication。
