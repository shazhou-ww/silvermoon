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
- Inner-contract baseline commit:
  `b36ad1b28e13b7c44ff75b871e81d99f166d2e54`
- Repository deliverables commit: 待提交后记录
- Implementation revision: 由最终同步后的 `whats-next` report 提供；world tree
  不记录自己的 revision，避免内容寻址自引用

## Stable-ID evidence

| Stable ID | Repository evidence | Verification | 状态 |
| --- | --- | --- | --- |
| `I-AC01` | `Implementation.md`、`open-source-contract.md`、本文件与 `ledger.md` | `silvermoon check --worktree`、stable-ID diff | 通过 |
| `I-AC02` | `.github/dependabot.yml` 与三项外部 settings 应用协议 | readiness contract tests | 通过 |
| `I-AC03` | `.github/rulesets/main.json` 与 CI `Required checks` | workflow/ruleset contract tests；GitHub Actions app ID `15368` 读回 | 通过 |
| `I-AC04` | 两个 workflow 的全部 `uses` SHA pin 与 Actions update entry | 全 workflow scan；上游 tag ref 解析 | 通过 |
| `I-AC05` | `package.json`、双语 README、reference 与 registry verifier | manifest/doc tests、pack check、installed-package E2E | 通过 |
| `I-AC06` | `CHANGELOG.md` 与 `0.3.0` GitHub Release notes | release artifact tests；tag/release/registry absence observation | 通过 |
| `I-AC07` | 定向、sanity、release-grade 与 Silvermoon validations | 下方命令证据 | 通过 |

## Immutable Action identities

2026-09-30 从各 action repository 的 major 与 semantic tag refs 解析并由全 workflow
contract test 锁定：

| Action | Version | Commit |
| --- | --- | --- |
| `actions/checkout` | `v4.4.0` | `11d5960a326750d5838078e36cf38b85af677262` |
| `actions/checkout` | `v6.1.0` | `d23441a48e516b6c34aea4fa41551a30e30af803` |
| `actions/setup-node` | `v4.4.0` | `49933ea5288caeca8642d1e84afbd3f7d6820020` |
| `actions/setup-node` | `v6.5.0` | `249970729cb0ef3589644e2896645e5dc5ba9c38` |
| `pnpm/action-setup` | `v4.3.0` | `b906affcce14559ad1aafd4ab0e942779e9f58b1` |

## Validation results

本地验证时间为 2026-09-30T05:56:47Z。测试均针对完整 worktree candidate；staged
snapshot 在最终 index 形成后补充。

| 命令 | 结果 | 关键证据 |
| --- | --- | --- |
| `node --test test/contract/open-source-readiness.test.mjs test/contract/ci.test.mjs test/contract/npm-release.test.mjs test/integration/verify-npm-release.test.mjs` | exit 0 | 12 tests passed；覆盖 settings config、ruleset、SHA pins、metadata、release artifacts 与 registry verifier |
| `pnpm check:sanity` | exit 0 | syntax 通过；93 tests passed；`CHECK_TOTAL 2431ms` |
| `pnpm pack:check` | exit 0 | `PACK_OK name=silvermoon version=0.3.0 files=49` |
| `pnpm test:e2e` | exit 0 | installed package metadata 与 CLI 通过；`PACK_SMOKE_OK name=silvermoon version=0.3.0` |
| `pnpm check` | exit 0 | 全部 release-grade gates 通过；contract 31/31、integration 128 passed + 2 privilege skips、E2E 1/1；`CHECK_TOTAL 116158ms` |
| `pnpm check:commit` | exit 0 | contract、Markdown、skill consistency、sanity、smoke、diff 与 staged metadata gates 全部通过 |
| `silvermoon check --worktree --audience agent` | exit 0 | worktree snapshot 通过 |
| `silvermoon check --staged --audience agent` | exit 0 | 完整 21-file implementation index 通过；记录本结果后重新 stage 并复验 |

第一次定向测试有 1 个 contract assertion 失败：测试要求动态错误消息以完整字面量存在于
source。实现本身的 metadata 行为与 integration test 已通过；修正 assertion 以验证
`assertPublicMetadata` 调用和常量后，12/12 重跑通过。

发布准备还修复了与本 candidate 紧密耦合的既有 verifier 缺陷：PNG mascot 曾被错误
要求返回 SVG MIME。当前实现按每个 asset 的 `image/svg+xml` 或 `image/png` 契约验证，
并有错误 MIME 回归测试。

## Release absence observation

2026-09-30T05:56:47Z 的只读预检返回：

- `TAG_ABSENT npm/silvermoon/v0.3.0`
- `GITHUB_RELEASE_ABSENT npm/silvermoon/v0.3.0`
- `NPM_VERSION_ABSENT silvermoon@0.3.0`

这些结果证明 implementation 没有提前部署；它们不授权后续发布，且 Deployment 必须在
执行前重新观察。

## External handoff

Implementation acceptance 后，Deployment 必须重新观察外部状态并按
`open-source-contract.md` 执行。当前 implementation evidence 不代表已经启用
private vulnerability reporting、Dependabot security updates、CodeQL default
setup 或 `main` ruleset，也不代表已经创建 `0.3.0` tag、GitHub Release 或 npm
publication。
