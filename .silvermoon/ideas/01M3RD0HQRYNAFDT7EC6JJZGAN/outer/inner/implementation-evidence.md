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
- Repository deliverables commit:
  `e7e453e039498a6636c5c4df8881a7b33bb17e61`
- RC rescope baseline commit:
  `3fba961d8b63419c92f18e7b36cacd9f9fbac6c9`
- RC contract commit:
  `f6a870c287f1aa10c0571ecde5a5bd45c7eaf641`
- RC repository deliverables commit:
  `e23f3d0d298a4a8e0c4f390719914abe69d62946`
- RC2 recovery contract commit:
  `de2cf95f34f91912e97292a29b2513a5c4940eef`
- Implementation revision: 由最终同步后的 `whats-next` report 提供；world tree
  不记录自己的 revision，避免内容寻址自引用

## RC change authorization

2026-09-30，用户要求优先发布 release candidate，并明确选择
`silvermoon@0.3.0-rc.1`。该决定授权准备和后续可信发布 RC，不授权
`npm/silvermoon/v0.3.0`、稳定 GitHub Release 或 npm `latest` 更新。

同步后的 `origin/main` 比上一 deployment evidence candidate 前进 19 个 commits，
包含双语 README 文案、Actions major upgrades、production dependency 与相关 contract
test 更新。RC implementation 因此必须针对 `3fba961d8b63419c92f18e7b36cacd9f9fbac6c9`
重新验证，不能复用旧 release-grade 结果。初步只读 observation 显示远端不存在
`npm/silvermoon/v0.3.0*` tag，npm 已发布版本止于 `0.2.2`。

## RC2 recovery authorization

`0.3.0-rc.1` 已由 trusted publisher 写入 npm，并带 publish 与 SLSA provenance
attestations，但 hosted run `36686662834` 的 verifier 错误要求当前 README 引用已移除的
avatar artwork，最终失败且未创建 GitHub prerelease。tag、npm version 与 provenance
保持不可变，完整外部事实记录在 `deployment-evidence.md`。

用户明确选择“修复 verifier 并发布 `0.3.0-rc.2`”。本 implementation revision
不得修改 rc.1 tag 或覆盖 registry bytes；它只修复 verifier 根因、增加 regression
coverage、准备新的 rc.2 manifest/changelog/notes，并重新通过完整 validation。

## Current stable-ID evidence

| Stable ID | Repository evidence | Verification | 状态 |
| --- | --- | --- | --- |
| `I-AC01` | RC2 recovery scope 已写入 `Implementation.md`、`open-source-contract.md`、本文件与 `ledger.md` | `silvermoon check --worktree`、`pnpm check:commit`、stable-ID diff | 通过 |
| `I-AC02` | `.github/dependabot.yml` 与三项外部 settings 应用协议 | readiness contract tests | 通过 |
| `I-AC03` | `.github/rulesets/main.json` 与 CI `Required checks` | workflow/ruleset contract tests；GitHub Actions app ID `15368` 读回 | 通过 |
| `I-AC04` | 当前两个 workflow 的全部 `uses` SHA pin 与 Actions update entry | 全 workflow scan；exact version comments | 通过 |
| `I-AC05` | rc.2 `package.json`、reference、release planner 与 registry verifier | manifest/doc/release-plan tests、pack check、installed-package E2E | 通过 |
| `I-AC06` | rc.1 历史、`CHANGELOG.md` 与 `0.3.0-rc.2` GitHub prerelease notes | release artifact tests；tag/release/registry absence observation | 通过 |
| `I-AC07` | 定向、sanity、release-grade 与 Silvermoon validations | RC2 命令证据 | 通过 |
| `I-AC08` | verifier 接受实际 immutable asset references 且不要求未引用 artwork | integration regression、真实 rc.1 re-verification | 通过 |

## RC2 implementation results

RC2 candidate 本地验证完成于 2026-09-30T08:17:37Z：

| 命令 | 结果 | 关键证据 |
| --- | --- | --- |
| `node --test test/integration/verify-npm-release.test.mjs test/contract/open-source-readiness.test.mjs test/unit/prepare-npm-release.test.mjs` | exit 0 | 14/14；README fixture 只引用 logo/mascot，未引用 avatar，同时完整 asset/MIME/provenance checks 通过 |
| `node scripts/prepare-npm-release.mjs --tag npm/silvermoon/v0.3.0-rc.2 --commit <baseline>` | exit 0 | `version=0.3.0-rc.2`、`distTag=rc`、`publicationState=absent` |
| `pnpm check:sanity` | exit 0 | 93/93；`CHECK_TOTAL 2367ms` |
| `pnpm check` | exit 0 | contract 31/31、integration 128 passed + 2 privilege skips、E2E 1/1；`PACK_SMOKE_OK name=silvermoon version=0.3.0-rc.2`；`CHECK_TOTAL 110261ms` |
| `silvermoon check --worktree --audience agent` | exit 0 | RC2 candidate snapshot 通过 |
| `silvermoon check --staged --audience agent` | exit 0 | 完整 RC2 implementation index 通过；记录本结果后重新 stage 并复验 |

第一次 `pnpm check` 唯一失败是 `CHANGELOG.md` 的重复 `### Fixed` heading 触发
MD024；将 rc.2 heading 改为 `### Release verification fix` 后，
`pnpm lint:markdown` 与完整 `pnpm check` 重新执行并通过。没有把第一次失败删除或解释为
成功。

修复后的 verifier 还对已发布 rc.1 的真实 registry tarball 与 metadata 重新执行。
为避免 Windows `core.autocrlf=true` 改写 SVG worktree bytes，验证 fixture 从 rc.1 tag
使用 `git cat-file` materialize 原始 asset blobs；这些 blob 与 commit-pinned
jsDelivr bytes 的 SHA-256 一致。最终输出
`VERIFY_NPM_RELEASE_OK`，并验证：

- version `0.3.0-rc.1`、dist-tag `rc` 与 release commit
  `5e116d1fed423bbd1ebed3ec08f2c0b955823022`；
- tarball SHA-256
  `193cf12d62e9b18a6176cef8442442cded14cd58fd48bf96fb48468e1d379961`；
- registry integrity、49 files、MIT metadata、README；
- publish 与 SLSA provenance attestations；
- 三张 repository artwork 的 commit-pinned bytes 与 MIME。

这证明删除“每份 README 必须引用 allowlist 全集”的断言修复了 rc.1 假阴性，同时保留
tarball、实际 README references、全部 artwork 与 provenance 的 fail-closed 验证。

2026-09-30T08:17:37Z 对 official registry
`https://registry.npmjs.org` 和 GitHub 的只读 preflight 返回：

- `TAG_ABSENT npm/silvermoon/v0.3.0-rc.2`；
- `GITHUB_RELEASE_ABSENT npm/silvermoon/v0.3.0-rc.2`；
- `NPM_VERSION_ABSENT silvermoon@0.3.0-rc.2`；
- npm `latest=0.2.2`、`rc=0.3.0-rc.1`。

这些 facts 证明 rc.2 尚未被消耗，rc.1 保持不可变；它们不代表 rc.2 已部署。

## RC implementation results

### Immutable Action identities

同步后的两个 workflow 只使用下列 full-SHA identities；同行 version comment 与
Dependabot 更新后的实际 action version 一致：

| Action | Version | Commit |
| --- | --- | --- |
| `actions/checkout` | `v7.0.1` | `3d3c42e5aac5ba805825da76410c181273ba90b1` |
| `actions/setup-node` | `v7.0.0` | `820762786026740c76f36085b0efc47a31fe5020` |
| `pnpm/action-setup` | `v6.1.0` | `ea17c68df8912ef543352723c149a84f56e3d413` |

### Local validation

RC candidate 本地验证完成于 2026-09-30T07:34:12Z：

| 命令 | 结果 | 关键证据 |
| --- | --- | --- |
| `node --test test/contract/open-source-readiness.test.mjs test/unit/prepare-npm-release.test.mjs test/integration/verify-npm-release.test.mjs` | exit 0 | 14/14；覆盖 exact RC materials、named dist-tag 与 prerelease registry verification |
| `node scripts/prepare-npm-release.mjs --tag npm/silvermoon/v0.3.0-rc.1 --commit <baseline>` | exit 0 | `version=0.3.0-rc.1`、`distTag=rc`、`publicationState=absent` |
| `pnpm check:sanity` | exit 0 | 93/93；`CHECK_TOTAL 2945ms` |
| `pnpm pack:check` | exit 0 | `PACK_OK name=silvermoon version=0.3.0-rc.1 files=49` |
| `pnpm test:e2e` | exit 0 | installed package 与 CLI 通过；`PACK_SMOKE_OK name=silvermoon version=0.3.0-rc.1` |
| `pnpm check` | exit 0 | contract 31/31、integration 128 passed + 2 privilege skips、E2E 1/1；`CHECK_TOTAL 129261ms` |
| `silvermoon check --worktree --audience agent` | exit 0 | RC candidate snapshot 通过 |
| `silvermoon check --staged --audience agent` | exit 0 | 完整 RC implementation index 通过；记录本结果后重新 stage 并复验 |

### Release absence and channel observation

2026-09-30T07:34:12Z 的只读 preflight 返回：

- `TAG_ABSENT npm/silvermoon/v0.3.0-rc.1`；
- `GITHUB_RELEASE_ABSENT npm/silvermoon/v0.3.0-rc.1`；
- `NPM_VERSION_ABSENT silvermoon@0.3.0-rc.1`；
- npm `latest=0.2.2`、历史 `rc=0.2.0-rc.1`。

这些 facts 证明 RC version 尚未被消耗，且当前 `latest` 不受候选准备影响。它们不代替
implementation acceptance，也不授权稳定 `0.3.0`。

RC contract commit 的 hosted
[CI run 36683894662](https://github.com/shazhou-ww/silvermoon/actions/runs/36683894662)
成功，`Required checks` job `109785607420` 为 success。repository deliverables
commit 的 hosted
[CI run 36684657771](https://github.com/shazhou-ww/silvermoon/actions/runs/36684657771)
也成功，精确 head SHA 为
`e23f3d0d298a4a8e0c4f390719914abe69d62946`：

- `Repository contracts` job `109787624326`：success；
- `Package contents and installed CLI` job `109787671015`：success；
- `Required checks` job `109787993033`：success。

该 run 实际执行 package validation，证明同步到 primary 的 RC manifest、tarball 与
installed CLI candidate 通过 hosted checks。

## Accepted implementation baseline

以下 identities、validation 与 hosted CI 证明历史上已验收的 implementation revision
`276b88c0c55afa47717991105f67bc768f4aeb38`。它们保留为审计记录，但不替代
`0.3.0-rc.1` candidate 的重新验证。

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

## Hosted CI evidence

Repository deliverables commit
`e7e453e039498a6636c5c4df8881a7b33bb17e61` 同步到 `main` 后触发 hosted
[CI run 36675930102](https://github.com/shazhou-ww/silvermoon/actions/runs/36675930102)。
run conclusion 为 `success`，全部 11 个 jobs 成功，包括跨平台 Node 22/24 unit matrix、
repository contracts、Git integration、package contents/installed CLI，以及新的
[Required checks](https://github.com/shazhou-ww/silvermoon/actions/runs/36675930102/job/109761011062)
聚合 gate。该 context 由 GitHub Actions app integration ID `15368` 产生，与
`.github/rulesets/main.json` 一致。

## Baseline release absence observation

2026-09-30T05:56:47Z 的只读预检返回：

- `TAG_ABSENT npm/silvermoon/v0.3.0`
- `GITHUB_RELEASE_ABSENT npm/silvermoon/v0.3.0`
- `NPM_VERSION_ABSENT silvermoon@0.3.0`

这些结果证明 implementation 没有提前部署；它们不授权后续发布，且 Deployment 必须在
执行前重新观察。

## External handoff

新 implementation acceptance 后，Deployment 必须重新观察 release surfaces 并按
`open-source-contract.md` 执行。既有 `deployment-evidence.md` 继续证明已启用的
private vulnerability reporting、Dependabot security updates、CodeQL default
setup 与 `main` ruleset；它不证明已经创建 `0.3.0-rc.1` tag、GitHub prerelease
或 npm publication。
