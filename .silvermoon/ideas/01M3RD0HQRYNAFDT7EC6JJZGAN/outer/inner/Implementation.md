# Implementation

## Steps

### I-S01: 固化主体世界实施与外部设置契约

在 `open-source-contract.md` 中记录实施边界、已观察的 GitHub 基线、目标设置、
幂等应用方法、失败行为和外部验证矩阵；在 `implementation-evidence.md` 中按稳定
ID 汇总 repository candidate 的实际证据。Implementation 只形成 repository-owned
候选，不启用 GitHub settings，不创建或推送 release tag，也不发布 npm package。

### I-S02: 建立依赖与安全更新自动化

增加最小 `.github/dependabot.yml`，每周检查根目录 npm dependencies 与全部
GitHub Actions，并限制并发更新数量。Private vulnerability reporting、Dependabot
security updates 与 CodeQL default setup 的实际启用留在 Deployment，但其精确
API 契约、目标状态和验证查询必须在主体世界中可复核。

### I-S03: 固化 main ruleset 与必需 CI gate

增加可由 GitHub Rulesets API 直接应用的 `.github/rulesets/main.json`：只覆盖
`refs/heads/main`，禁止删除和 non-fast-forward 更新，要求唯一稳定的
`Required checks` context，并为当前 maintainer 保留显式恢复 bypass。CI 增加聚合
gate，只有核心测试成功且按风险需要的 package job 成功或明确跳过时才通过；不增加
会破坏现有 ordinary non-force synchronization 的 PR-only 限制。

### I-S04: 固定 Actions 引用并约定自动升级

将所有第三方 GitHub Actions `uses` 引用固定到其当前版本对应的完整 commit SHA，
同行保留精确语义版本注释。GitHub Actions Dependabot 只通过可审查 PR 更新 SHA 与
版本注释，不使用 movable major tag，也不静默自动合并。

### I-S05: 明确 npm metadata 与 experimental JavaScript API

将明确授权的稳定候选版本设为 `0.3.0`，并保留 `package.json` 中显式的项目主页、
问题入口、作者、贡献者和维护者身份。`docs/reference.md` 作为根 package export
在 `1.0.0` 前属于 experimental 的权威 reader documentation：minor release 可以
发生 breaking change，使用者应固定精确版本；CLI、schema 与文件格式的独立契约
不由该声明降级。release planner 必须把稳定版本映射到 npm `latest`，但 tag 创建与
`latest` 更新仍只发生在本 revision 明确验收后的 Deployment。

### I-S06: 准备稳定 0.3.0 changelog 与 GitHub Release

保留已经发布的 `0.3.0-rc.1` 与 `0.3.0-rc.2` changelog、notes 和不可变历史，在
`CHANGELOG.md` 增加稳定 `0.3.0` entry，并完成
`.github/release-notes/0.3.0.md`。稳定材料必须准确汇总 release series、MIT
许可、Node compatibility、pre-1.0 API 边界、npm `latest` channel、protected
tag、OIDC trusted-publishing 与 post-publication verifier。release tag、workflow
publication 和 GitHub stable Release 都留到本 implementation revision 明确验收后的
Deployment，不修改或替换任何 RC tag、npm version 或 prerelease。

### I-S07: 验证候选并固化实施证据

增加针对 Dependabot、ruleset、CI gate、Actions SHA、npm metadata、experimental
API 文档、稳定 `latest` dist-tag 和 release artifacts 的 contract tests。运行定向测试、
`pnpm check:sanity`、release-grade `pnpm check` 及 Silvermoon worktree/staged
snapshot validation，把命令、结果和候选身份记录到 `implementation-evidence.md`。

### I-S08: 修复 README immutable asset verifier

修复 post-publication verifier 将 repository artwork allowlist 误当成“每份 README
必须引用全部 artwork”的逻辑。verifier 必须接受当前 README 实际引用的 logo 与
mascot，继续拒绝 mutable/relative release references，并继续验证所有 repository
artwork 的 commit-pinned URL 与正确 MIME；增加“allowlisted 但未被 README 引用的
avatar 不阻塞发布”回归测试，不降低 tarball、README、integrity 或 provenance 检查。

## Acceptance criteria

### I-AC01: 主体世界契约与阶段边界完整

`Implementation.md`、`open-source-contract.md`、
`implementation-evidence.md` 与 `ledger.md` 使用一致稳定 ID，明确区分
repository implementation、已完成的 GitHub settings/RC deployment，以及用户通过
`/publish 0.3.0` 明确授权但尚未部署的稳定 candidate；通过 Silvermoon snapshot
validation 和人工 diff 复核证明。

### I-AC02: 安全与依赖更新候选可验证

`.github/dependabot.yml` 同时覆盖 npm 与 GitHub Actions；外部契约给出 private
vulnerability reporting、Dependabot security updates 和 CodeQL default setup 的
目标状态、幂等写入与读回验证，且任何读回不一致都会阻塞 Deployment acceptance。
通过 contract test 和 supporting contract diff 证明。

### I-AC03: main 保护与 CI gate 保持协作路径

`.github/rulesets/main.json` 精确保护 `main` 的删除、force push 与未通过
`Required checks` 的更新，同时保留 maintainer bypass；CI 聚合 gate 对核心 job
fail-closed，并正确处理 risk-based package job。通过解析 workflow 与 ruleset 的
contract tests 证明。

### I-AC04: Actions 供应链引用不可变且可更新

`.github/workflows` 中所有外部 `uses` 都是完整 commit SHA，并带精确版本注释；
Dependabot 的 `github-actions` entry 提供受审查更新路径。通过扫描全部 workflow 的
contract test 证明，不以抽样代替。

### I-AC05: npm metadata 与 pre-1.0 API 边界显式

`package.json` 的 `version` 为 `0.3.0`，显式 metadata 指向本 repository、
issues 与 maintainer；`docs/reference.md` 说明 experimental 根 export、允许的
pre-1.0 breaking-change 边界及精确版本固定建议。发布规划器将该版本映射为 npm
`latest` dist-tag；通过 manifest/doc/release-plan contract tests 和
`npm pack --dry-run` 证明。Implementation 不创建 tag 或更新 registry。

### I-AC06: 稳定 0.3.0 发布材料完整但未部署

`CHANGELOG.md` 与稳定 GitHub Release notes 保留 rc.1/rc.2 历史并准确说明稳定
release scope、兼容性、MIT 许可和 `latest` channel；既有 RC surfaces 保持不可变，
候选中不存在新建的 `npm/silvermoon/v0.3.0` tag、GitHub stable Release、npm exact
version 或本地 publish 行为。通过 Git diff、release contract tests 和
tag/registry observation 证明。

### I-AC07: Repository candidate 通过完整验证

全部定向 contract tests、`pnpm check:sanity`、`pnpm check`、
`silvermoon check --worktree` 与 `silvermoon check --staged` 成功，验证输出与候选
commit 身份记录在 `implementation-evidence.md`，可供精确 implementation revision
验收复核。

### I-AC08: Verifier 反映实际 README asset contract

post-publication verifier 对 generated README 的实际 immutable references
fail-closed，但不要求 README 引用未使用的 allowlisted artwork；当前双语 README
缺少 avatar 引用时验证成功，任一实际引用仍为 relative/mutable、asset MIME 错误、
tarball/registry README 不一致或 provenance 不一致时仍失败。通过 integration
regression tests 和真实 rc.1 failure fixture 证明。
