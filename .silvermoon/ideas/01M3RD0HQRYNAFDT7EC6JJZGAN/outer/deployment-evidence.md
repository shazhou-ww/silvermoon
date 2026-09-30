# Deployment evidence

本文档服务于 `Deployment.md`，记录 GitHub 与 npm 外部结果。它不是第四份 world
contract，也不代表未执行动作已经完成。

## Deployment identity

- Idea: `open-source-readiness`
- ULID: `01M3RD0HQRYNAFDT7EC6JJZGAN`
- Accepted implementation revision:
  `728ceb204ec3a736d0bd9269db1582299c61dd28`
- Implementation acceptance commit:
  `ec34b05d3d5c04bca8f47ea1798b0df1c54911ae`
- Deployment contract commit:
  `694a83d9b484642e34e8185f0e48ea51868d968b`
- RC deployment contract commit:
  `fa65a8fbc6344f660e6482955332d18693fc495c`
- GitHub settings evidence commit:
  `82a2280cca86d3bd5acc0f5ba7ce9a044cfeb8d3`
- Deployment revision: 由同步后的 `whats-next` report 提供；world tree 不记录自己
  的 revision，避免内容寻址自引用
- Initial synchronized deployment revision:
  `b00714e1182b03d00d502c645256ff07eeeb9d66`
- GitHub settings evidence revision:
  `5e3e5ad9c72a7bef84f92c74125634f3126e4846`
- RC deployment contract revision:
  `a37b660b188fd14f3bb3382df717c421f778259b`

## Active release hold

先前 README hold 已由 primary commit
`fb1ce53` 的双语文案更新和后续 RC candidate 取代。2026-09-30，用户要求优先发布
RC；rc.1 publish 成功但 hosted verifier 假阴性后，用户明确选择修复根因并发布
`silvermoon@0.3.0-rc.2`。该 recovery 选择只覆盖 rc.2，不覆盖稳定 `0.3.0`。

因此 rc.2 implementation acceptance 后允许按本 Deployment contract 执行：

- 创建并普通推送 `npm/silvermoon/v0.3.0-rc.2`；
- 只通过 npm trusted-publishing workflow 发布到 `rc` dist-tag；
- verifier 成功后创建 GitHub prerelease。

稳定 hold 继续生效：

- 不创建或推送 `npm/silvermoon/v0.3.0`；
- 不创建稳定 GitHub Release；
- 不发布 npm exact `0.3.0` 或更新 `latest`；
- 不本地运行 `npm publish`；
- primary 发生新变更后，旧 release preflight 一律失效并重新执行。

RC 成功后仍需用户评估，再通过新的 stable implementation candidate 和授权推进
`0.3.0`。

## Stable-ID evidence

| Stable ID | 外部结果 | 证明 | 状态 |
| --- | --- | --- | --- |
| `D-AC01` | RC2 recovery 外层契约同步且 revision 稳定 | primary commit、Silvermoon worktree/staged checks、`whats-next` | 待同步 |
| `D-AC02` | Private reporting、vulnerability alerts 与 security updates enabled | GitHub API、advisory route、config blob | 通过 |
| `D-AC03` | CodeQL configured 且两类 analysis 成功 | default-setup API、analysis IDs、run `36677849388` | 通过 |
| `D-AC04` | main/tag rulesets active 且普通同步可用 | ruleset API、rule suite、push/ancestry、hosted CI | 通过 |
| `D-AC05` | Community Profile 100%，Issue Forms 与 security/support routes 存在 | Community Profile/contents API、公开 URL 与预期 sign-in redirect | 通过 |
| `D-AC06` | RC2 recovery、accepted candidate 与 fresh preflight 精确绑定 | user choice、absence、planner、ancestry | 待预检 |
| `D-AC07` | `0.3.0-rc.2` 不可变发布身份一致 | workflow、registry、release、provenance | 待发布 |
| `D-AC08` | npm `rc` 更新到 rc.2 且 `latest`/stable surfaces 不变 | dist-tags、prerelease 与 absence observations | 待发布 |
| `D-AC09` | 稳定 `0.3.0` 仍需新候选与授权 | lifecycle、status、absence observations | hold 生效 |
| `D-AC10` | 最终稳定公共开源契约完整 | 本文件、ledger、final diff/checks | 等待前置项 |

## External observations

每次写入遵循“先读、判断、单次写入、立即读回、记录响应”。只保留验证所需字段，不持久化
credential、header 或 token。

### GitHub security and analysis

2026-09-30T06:20:44Z 的写入前 observation：

- private vulnerability reporting：`enabled: false`；
- Dependabot automated security fixes：`enabled: false`、`paused: false`；
- default branch 已存在 `.github/dependabot.yml`，blob
  `b2a17ad67e2e447b326776887f9152cd5955abbc`。

Private vulnerability reporting 的单次 PUT 成功。Dependabot security updates 的
第一次 PUT 返回 HTTP 422：
`Vulnerability alerts must be enabled to configure automated security fixes.`。
06:21:20Z 的 `GET /vulnerability-alerts` 返回 HTTP 404 和
`Vulnerability alerts are disabled.`，确认根因而不是将失败视为成功。随后：

1. `PUT /vulnerability-alerts` 成功，GET 读回 HTTP 204；
2. 再次 `PUT /automated-security-fixes` 成功；
3. 06:21:43Z 读回 private reporting `enabled: true`；
4. 同时读回 automated security fixes `enabled: true`、`paused: false`。

匿名访问
`https://github.com/shazhou-ww/silvermoon/security/advisories/new`
会跳转 GitHub sign-in，并保留该 URL 为 `return_to`；这符合私密 advisory 创建必须
认证、而不是转成公开 issue 的边界。

CodeQL 在 06:21:53Z 的 baseline 为 `state: not-configured`、无 analysis。单次 PATCH
使用 `state: configured`、`query_suite: default`，返回
[run 36677849388](https://github.com/shazhou-ww/silvermoon/actions/runs/36677849388)。
该 run 对 deployment contract commit 执行并成功：

- `Analyze (javascript-typescript)` job `109766642269`：success；
- `Analyze (actions)` job `109766642594`：success；
- default setup 于 06:23:33Z 更新为 `configured`，query suite 为 `default`，
  languages 为 `actions`、`javascript`、`javascript-typescript`、`typescript`；
- main analysis `1864558729` 对应 `javascript-typescript`，analysis
  `1864556881` 对应 `actions`，两者 commit 均为
  `694a83d9b484642e34e8185f0e48ea51868d968b`；
- Dependabot 与 CodeQL open alerts API 均成功返回 `open_count: 0`。

### Repository rulesets

2026-09-30T06:23:59Z，repository 只有 active tag ruleset
`Protect npm release tags`（ID `23758427`）。其 target、include、maintainer bypass
以及 creation/update/deletion rules 与 implementation baseline 一致。

由于没有同名 branch ruleset，使用 committed `.github/rulesets/main.json` 单次创建
[Protect main](https://github.com/shazhou-ww/silvermoon/rules/24230202)
（ID `24230202`）。06:24:17Z 读回：

- `target: branch`、`enforcement: active`；
- include 只有 `refs/heads/main`，exclude 为空；
- bypass actor 为 user `242885595`、mode `always`；
- rules 按序为 `deletion`、`non_fast_forward`、`required_status_checks`；
- required context 为 GitHub Actions integration `15368` 的
  `Required checks`，strict policy 为 true；
- ruleset 列表恰有上述 branch/tag 两项；
- tag ruleset ID `23758427` 再次读回未变化。

GitHub settings evidence candidate 使用 ordinary non-force
`HEAD:main` push 从 `694a83d9b484642e34e8185f0e48ea51868d968b` 更新到
`82a2280cca86d3bd5acc0f5ba7ce9a044cfeb8d3`，没有 force、tag 或 history rewrite。
GitHub 明确返回 configured maintainer bypass，并指出 push 时
`Required checks` 尚未产生；rule suite `4290502544` 对 `refs/heads/main` 记录同一
before/after SHA、actor `shazhou-ww` 与 result `bypass`，证明 bypass 是 active
ruleset 的可审计结果，而不是规则缺失。

2026-09-30T06:28:32Z 刷新 `origin/main` 后，`git merge-base --is-ancestor`
确认 `82a2280cca86d3bd5acc0f5ba7ce9a044cfeb8d3` 可达。随后
[CI run 36678396244](https://github.com/shazhou-ww/silvermoon/actions/runs/36678396244)
对该精确 commit 成功完成，`Required checks` job `109768498959` 为 success；仅
`Package contents and installed CLI` 按文档-only risk selection 正常 skipped。
因此 active main ruleset、预期 maintainer maintenance path 和 required check
context 均有实际外部证据，既有 tag ruleset 保持不变。

### Community surfaces

2026-09-30T06:24:33Z，GitHub Community Profile API 返回
`health_percentage: 100`，并识别：

- `CODE_OF_CONDUCT.md`；
- `CONTRIBUTING.md`；
- MIT `LICENSE`；
- `.github/PULL_REQUEST_TEMPLATE.md`；
- `README.md`。

Default branch contents API 同时列出：

- `bug_report.yml` blob `1425f1a45acd2eeb20a2231737ab71acd6bc4f97`；
- `feature_request.yml` blob `fdb04ab87b14573e34745761f5962029dbb963e5`；
- `config.yml` blob `6cb7aea2f815de52cd950a889a0e77f5472f0f61`。

`config.yml` 保留 blank issue，并把 vulnerability 与 support 分别路由到
`/security/policy` 和 default-branch `SUPPORT.md`。公开 security policy URL 成功渲染
repository policy；Issue Forms 与 private advisory 创建 URL 在匿名 browser 中按预期
跳转 GitHub sign-in 并保留精确 `return_to`。

Community Profile 的 `issue_template` 字段为 `null`，GraphQL `issueTemplates` 为空。
这是 GitHub public API 不枚举 YAML Issue Forms 的已知表示边界，不能单独作为 forms
缺失或存在的证明；因此本结论同时依赖 default-branch contents、canonical YAML 和
chooser URL 的认证跳转，不伪造 API recognition。

### Release surfaces

2026-09-30T07:34:12Z 的 RC implementation preflight 已观察：

- `TAG_ABSENT npm/silvermoon/v0.3.0-rc.1`；
- `GITHUB_RELEASE_ABSENT npm/silvermoon/v0.3.0-rc.1`；
- `NPM_VERSION_ABSENT silvermoon@0.3.0-rc.1`；
- npm `latest=0.2.2`、历史 `rc=0.2.0-rc.1`。

这些 observations 早于 implementation acceptance；D-S06 必须在最新 primary 上重新
执行后才能创建 tag。

2026-09-30T07:50:30Z 对 primary
`84d917dee90868e86f1bd7d0b7d3a77a64cd62ba` 的 first deployment preflight 通过，
但随后 primary 前进到包含最终 README 更新的
`5e116d1fed423bbd1ebed3ec08f2c0b955823022`，因此旧结果按契约失效且没有创建 tag。
对新 tip 重新运行 `pnpm check`、release planner、hosted CI 与外部 absence checks：

- release-grade checks exit 0；
- planner 返回 `version=0.3.0-rc.1`、`distTag=rc`、
  `publicationState=absent`；
- [CI run 36686112542](https://github.com/shazhou-ww/silvermoon/actions/runs/36686112542)
  的 package job `109793389519` 与 `Required checks` job `109793541709` 均为
  success；
- tag、GitHub Release 与 npm exact version 在 tag 创建前均不存在；
- npm `latest=0.2.2`、历史 `rc=0.2.0-rc.1`。

随后普通推送不可变 tag `npm/silvermoon/v0.3.0-rc.1`，远端 ref 与本地 tag 均解析到
`5e116d1fed423bbd1ebed3ec08f2c0b955823022`。GitHub 返回 active tag ruleset 的
configured maintainer bypass，未移动或重建任何 tag。

Trusted-publishing
[run 36686662834](https://github.com/shazhou-ww/silvermoon/actions/runs/36686662834)
的 publish step 成功：

- npm 输出 `+ silvermoon@0.3.0-rc.1`，使用 `rc` dist-tag；
- Sigstore transparency log index 为 `3014623306`；
- registry version 的 `gitHead` 为 release commit，MIT、homepage、bugs 与
  repository metadata 正确；
- tarball integrity 为
  `sha512-0JWIBZFcGx4vKG8QtMbdzrwITizDp01cLVmKC4HjX3T0htQJB9G4yRGcZ3QEVPRo9iy4cBq0K8i958Pqr9+aSg==`，
  shasum 为 `992b0587c400519653b3d28c2e2e87fe90fb3c24`；
- npm attestation endpoint 返回 publish 与 SLSA provenance 两类 predicate；
- npm dist-tags 最终读回 `rc=0.3.0-rc.1`、`latest=0.2.2`。

同一 run 的 `Verify published package` step 在 12 次 retry 后失败，错误始终为：
`README.md is missing immutable asset URL .../assets/silvermoon-avatar.svg.`。
最终 README 合法只引用 `silvermoon.svg` 与 `silvermoon-mascot.png`；verifier
仍错误要求每份 README 引用 allowlist 中全部三张 artwork。因此这是发布后 verifier
与当前 README 的契约缺陷，不是 npm publish、tarball identity 或 provenance 失败。
run conclusion 仍为 `failure`，且按 fail-closed 顺序没有创建 GitHub prerelease。

用户随后明确选择保留不可变 rc.1 审计事实、修复 verifier 并发布
`0.3.0-rc.2`。该恢复必须返回新的 implementation candidate；不得移动 rc.1 tag、
覆盖已发布 npm version，或把失败 run 记录为成功。

## Failures and recovery

权限不足、API schema 变化、重复同名 ruleset、CodeQL analysis 失败、public surface
不一致或 release identity 不一致都必须在本节记录，并保持对应 ledger item 未完成。
只在根因修复并重新验证后更新状态，不删除历史失败，也不以推断代替外部结果。

Dependabot security updates 首次 PUT 的 HTTP 422 已恢复；根因、前置设置与成功重试
均保留在上文。Issue Forms API 表示限制不是写入失败，已通过多项独立事实明确限定证据
强度。

当前未恢复失败是 rc.1 hosted verifier 对已移除 README avatar 引用的过度要求。
npm version 与 tag 已不可变，因此不修改或重发 rc.1；恢复路径是修复 verifier、增加
回归测试并发布新版本 `0.3.0-rc.2`。在 rc.2 hosted verifier 和 GitHub prerelease
成功前，D-S07、D-S08、D-AC07 与 D-AC08 保持未完成。
