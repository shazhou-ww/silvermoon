# Deployment

## Steps

### D-S01: 发布外层契约并建立部署证据

同步本 Deployment contract、`deployment-evidence.md` 与 ledger stable IDs 到
primary，重新观察精确 deployment revision，再执行任何外部写入。证据必须区分
repository candidate、GitHub settings、release authorization 与实际 npm/GitHub
Release 结果；任何失败都保留为显式阻塞。

### D-S02: 启用私密报告与依赖安全更新

按主体世界协议重新读取当前状态，幂等启用 GitHub private vulnerability reporting
与 Dependabot security updates，立即读回 API，并验证私密 advisory 入口和 default
branch 上的 npm/GitHub Actions Dependabot 配置。若外部状态与实施基线不同，先保留
并分析并发变更，不覆盖未知设置。

### D-S03: 启用并验证 CodeQL default setup

幂等配置 CodeQL default setup，使用 default query suite 和 GitHub 自动检测的
JavaScript/TypeScript 语言。读回 `configured` 状态后等待该精确 default branch
revision 的首次 analysis 完成；setup、workflow 或 analysis 失败均阻塞此步骤，不增加
并行 advanced-setup workflow。

### D-S04: 应用并验证 main ruleset

按名称唯一匹配 `Protect main`，使用 `.github/rulesets/main.json` 创建或更新，
再读回 canonical fields。确认 `main` 禁止删除和 non-fast-forward update、只接受
GitHub Actions app `15368` 产生的 `Required checks`、strict policy 生效且
maintainer bypass 保留。不得修改既有 `Protect npm release tags`；用后续普通
non-force evidence commit 证明维护路径仍可用，不执行 force 测试。

### D-S05: 核验 GitHub 公共开源表面

通过 GitHub API 与公开 URL 验证 Community Profile、issue chooser、贡献与行为准则、
支持和安全入口均指向 default branch 上的 repository-owned 文件；同时记录 private
reporting、Dependabot、CodeQL、branch ruleset 与 tag ruleset 的可复核链接或最小必要
响应字段。页面或 API 不一致时不使用文档声明代替实际结果。

### D-S06: 刷新并预检 0.3.0-rc.2 候选

基于用户在 rc.1 verifier 假阴性后对 `silvermoon@0.3.0-rc.2` recovery 的明确选择，
刷新 primary、tags、GitHub Releases 和 official npm metadata，确认 accepted
implementation、verifier fix、regression tests、`package.json`、changelog 与 rc.2
notes 均包含在同一精确 primary commit。重新执行 release planner 与 release-grade
checks，要求 rc.2 tag、GitHub prerelease 和 npm exact version 仍不存在，planner
返回 `distTag=rc`；任何新 primary 变更都会使旧 preflight 失效。

### D-S07: 通过可信链路发布 0.3.0-rc.2

只在 D-S06 满足后，于最新 `origin/main` 精确 commit 创建并普通推送不可变
`npm/silvermoon/v0.3.0-rc.2` tag。等待 `.github/workflows/publish-npm.yml`
成功并输出 `VERIFY_NPM_RELEASE_OK`，随后用已存在 tag、repository-owned RC notes
和 `--prerelease` 创建 GitHub prerelease；不本地运行 `npm publish`，不创建 token，
也不移动或重建 tag。

### D-S08: 验证 RC 身份与 channel 隔离

读回 GitHub prerelease、npm exact RC version、`rc` 与 `latest` dist-tags、MIT
license、homepage、bugs、maintainer、package README、tarball integrity、
`gitHead`、npm publish attestation 与 SLSA provenance。要求 RC 表面全部指向同一
release commit，`rc` 指向 `0.3.0-rc.2`，`latest` 仍指向 `0.2.2`。将 successful
hosted run、immutable URLs、API 最小字段和 verifier 输出记录到
`deployment-evidence.md` 并同步到 primary。

### D-S09: 保持稳定 0.3.0 门禁并返回候选实施

RC 成功不授权稳定 release，也不把当前 prerelease manifest 直接发布为 stable。
在用户评估 RC 并明确授权稳定 `0.3.0` 前，保持
`npm/silvermoon/v0.3.0` tag、GitHub stable Release 与 npm exact version 不存在，
且 npm `latest` 不变。获得授权后，先通过新的 repository implementation candidate
把 manifest 和 release materials 切换到 `0.3.0`，重新完成 release-grade
validation 与精确 implementation revision acceptance，再返回 Deployment。

### D-S10: 发布稳定 0.3.0 并封存最终证据

只在 D-S09 的新 stable candidate 被验收后，通过同一 protected tag、OIDC trusted
publishing 和 post-publication verifier 发布不可变 `0.3.0`，创建 GitHub stable
Release，并要求 npm `latest`、tag、Release、tarball、`gitHead` 与 provenance
解析到同一 primary commit。将最终外部证据同步到 primary 后再进入 deployment
acceptance。

## Acceptance criteria

### D-AC01: 外层契约稳定且证据可追溯

Deployment contract、supporting evidence 与 ledger 使用一致 stable IDs，精确
deployment revision 已同步到 primary；通过 Silvermoon remote/snapshot validation、
primary ancestry 和 commit-pinned links 证明。

### D-AC02: 安全报告与 Dependabot 已实际启用

Private vulnerability reporting 与 Dependabot security updates API 均读回 enabled，
私密 advisory 入口可用，default branch 上 npm 与 GitHub Actions update config
可见；通过 API 响应、公开入口和 commit-pinned config 证明。

### D-AC03: CodeQL default setup 产生成功分析

CodeQL API 读回 `state: configured`、default query suite 与预期语言，且 default
branch 的 analysis 成功完成；通过 default-setup API、analysis/run URL 与精确 commit
证明。

### D-AC04: main 与 release tag 保护同时成立

Active `Protect main` ruleset 与 repository JSON canonical fields 一致，后续
non-force synchronization 成功；既有 active `Protect npm release tags` 保持不变。
通过两个 ruleset 的 API 响应、稳定 ID 与 push/ancestry 证据证明。

### D-AC05: GitHub Community Profile 与入口一致

GitHub 识别 repository community files，issue chooser routes 与 security/support
指引一致，公开链接可达；通过 Community Profile API、公开 URL 与 commit-pinned 文件
证明。

### D-AC06: RC 授权与 preflight 精确绑定

用户明确选择以 `0.3.0-rc.2` 恢复 rc.1 verifier 假阴性，accepted implementation
包含 verifier root fix、regression tests 与 exact rc.2 materials；tag、GitHub
prerelease 与 npm exact version 在创建前均不存在，release planner 返回
`distTag=rc`。通过带时间的 absence observations、primary ancestry、明确 recovery
选择和重新执行的 release preflight 证明。

### D-AC07: 0.3.0-rc.2 发布身份不可变且一致

`npm/silvermoon/v0.3.0-rc.2`、GitHub prerelease、npm
`silvermoon@0.3.0-rc.2`、`rc` dist-tag、tarball `gitHead`、integrity 与 provenance
全部解析到同一 primary commit，MIT 与公共 metadata 正确；通过 hosted workflow、
`VERIFY_NPM_RELEASE_OK`、registry 和 immutable release URLs 证明。

### D-AC08: RC channel 不改变稳定消费者

npm `rc` 指向 `0.3.0-rc.2`，`latest` 保持 `0.2.2`，GitHub Release 标记为
prerelease，稳定 tag/version 均不存在；通过 registry dist-tags、GitHub Release API
与 absence observations 证明。

### D-AC09: 稳定 0.3.0 门禁没有被 RC 绕过

RC 发布后，稳定 `0.3.0` 仍要求新的 accepted implementation revision、明确授权与
fresh preflight；在满足前不存在 stable tag、GitHub Release 或 npm exact version。
通过 lifecycle report、status fact 与外部 absence observations 证明。

### D-AC10: 公共开源契约完整可用

GitHub 与 npm 的最终 stable 公共结果同时满足 D-AC02 至 D-AC09，所有 evidence 已
同步到 primary 且没有未解释的失败、权限缺口或成功形状 fallback；通过
`deployment-evidence.md`、ledger、Silvermoon checks 与最终 candidate diff 证明。
