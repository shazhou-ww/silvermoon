# 开源设置与发布实施契约

本文档服务于 `Implementation.md`，把 repository-owned candidate 与后续
Deployment 中的 GitHub/npm 外部动作分开。它不是第四份 world contract，也不授权
发布。

## 已观察基线

以下事实于 2026-09-30 通过 GitHub REST API 读取，读取过程没有修改外部设置：

- private vulnerability reporting 为 disabled；
- Dependabot security updates 为 disabled；
- CodeQL default setup 为 `not-configured`；
- 唯一现有 active ruleset 是 tag ruleset `Protect npm release tags`，覆盖
  `npm/**`，不在本 idea 中替换或重复创建；
- repository homepage 尚未设置；npm `0.2.2` 的 registry license 仍显示
  `UNLICENSED`，历史版本不回写。

这些是 Deployment 的前置基线，不是完成证据。若外部状态在部署前发生变化，必须重新读取
并基于最新事实继续，不得覆盖并发维护者变更。

## Repository candidate

Repository candidate 应包含：

- `.github/dependabot.yml`：npm 与 GitHub Actions 的 weekly update PR；
- `.github/rulesets/main.json`：可直接提交给 GitHub Rulesets API 的 `main`
  ruleset body；
- `.github/workflows/ci.yml` 中唯一稳定的 `Required checks` 聚合 context；
- 全部 workflow action 的完整 SHA pin 与同行精确版本注释；
- `package.json` 中的 `0.3.0-rc.2` 版本、MIT 许可与显式公共 metadata；
- `docs/reference.md` 中的 pre-1.0 experimental JavaScript API contract；
- `CHANGELOG.md`、不可变的 rc.1 历史、
  `.github/release-notes/0.3.0-rc.2.md` 与保留供后续稳定版使用的
  `.github/release-notes/0.3.0.md`；
- 只要求 generated README 的实际 artwork references 为 commit-pinned URL、
  同时独立验证 repository artwork allowlist 的可达性与 MIME、但不要求每份 README
  引用 allowlist 全集的 post-publication verifier。

CodeQL 使用 GitHub default setup，不增加 advanced-setup workflow，以避免同一
repository 同时存在两套互相竞争的 CodeQL 配置。

## GitHub settings 应用协议

所有写入只在 implementation acceptance 后的 Deployment 中执行。每个动作都遵循
“先读、判断、单次写入、立即读回、记录响应”的顺序；权限不足、非预期现状、重复同名
ruleset 或读回不一致都必须停止。

### Private vulnerability reporting

1. 读取 `GET /repos/shazhou-ww/silvermoon/private-vulnerability-reporting`。
2. 仅在 `enabled` 不为 `true` 时调用
   `PUT /repos/shazhou-ww/silvermoon/private-vulnerability-reporting`。
3. 再次 GET，要求 `enabled: true`。
4. 打开 `https://github.com/shazhou-ww/silvermoon/security/advisories/new`，
   证明私密报告入口可达且未要求创建公开 issue。

### Dependabot security updates

1. 读取 `GET /repos/shazhou-ww/silvermoon/automated-security-fixes`。
2. 仅在 `enabled` 不为 `true` 时调用
   `PUT /repos/shazhou-ww/silvermoon/automated-security-fixes`。
3. 再次 GET，要求 `enabled: true`；同时确认 `.github/dependabot.yml` 已被
   default branch 识别。

### CodeQL default setup

1. 读取 `GET /repos/shazhou-ww/silvermoon/code-scanning/default-setup`。
2. 仅在 `state` 不为 `configured` 时 PATCH 同一路径，body 为
   `{"state":"configured","query_suite":"default"}`。
3. 再次 GET，要求 `state: configured`、`query_suite: default` 且检测语言包含
   JavaScript/TypeScript。
4. 等待 GitHub 返回的 setup/run 结果完成后，要求 default branch 存在成功的
   CodeQL analysis；失败或长期无结果都阻塞 acceptance。

## main ruleset 应用协议

目标 ruleset 名为 `Protect main`。Deployment 先列出 repository rulesets，并按名称
匹配：

- 零个匹配时，POST `.github/rulesets/main.json`；
- 一个匹配时，仅在 canonical fields 与文件不一致时 PUT 同一 ruleset ID；
- 多个匹配时停止，先由 maintainer 消除歧义。

写入后 GET 该 ruleset，并要求以下 canonical fields 与文件完全一致：

- `target: branch`、`enforcement: active`；
- include 只有 `refs/heads/main`；
- bypass actor 是 GitHub user `shazhou-ww` 的稳定 actor ID `242885595`，
  `bypass_mode: always`；
- rules 只有 `deletion`、`non_fast_forward` 与
  `required_status_checks`；
- required context 只有 `Required checks`，来源限定为 GitHub Actions app
  integration ID `15368`，strict policy 为 true。

不增加 `pull_request` 或 `update` rule。普通参与者仍受 required check 与
non-fast-forward 限制；maintainer bypass 保留故障恢复和 Silvermoon ordinary
non-force synchronization 路径，但不授权 force push。部署后用一个已通过 CI 的
ordinary non-force candidate 验证同步路径，不用 force 操作测试规则。

## 0.3.0-rc.2 发布与 GitHub prerelease 顺序

以下动作必须同时满足 implementation acceptance、idea 已进入 Deployment、候选 commit
可从最新 `origin/main` 到达，以及用户对 rc.1 failure 后
`0.3.0-rc.2` recovery 的明确选择：

1. 刷新 `origin/main` 与 tags，确认 `package.json`、changelog、release notes 和
   candidate commit；
2. 在精确 `origin/main` commit 创建不可变
   `npm/silvermoon/v0.3.0-rc.2` tag，并通过 ordinary Git push；
3. 等待 `.github/workflows/publish-npm.yml` 成功，保存 run、job、attestation、
   tarball identity、npm `rc` dist-tag 与 `VERIFY_NPM_RELEASE_OK` 证据，同时证明
   npm `latest` 仍指向先前稳定版本；
4. 使用既有 tag 和 `.github/release-notes/0.3.0-rc.2.md` 创建 GitHub
   prerelease，不让 release 命令隐式创建或移动 tag；
5. 读回 GitHub Release、npm registry metadata、provenance、README、MIT license、
   `rc` dist-tag 与 `gitHead`，要求全部指向同一版本和 commit。

不得本地运行 `npm publish`，不得创建 npm token，不得移动、删除或重建 release tag。
发布前失败时修复 `main` 并选择新版本；发布后验证失败时保留不可变版本与 tag，按既有
release runbook 处理。RC 成功不授权稳定 `0.3.0`：稳定版必须通过后续 repository
candidate 将 manifest 切换到 `0.3.0`，重新完成 implementation acceptance、
release-grade validation 与明确发布授权。

## 外部验证矩阵

Deployment evidence 至少记录：

| 表面 | 可观察结果 | 证明 |
| --- | --- | --- |
| Community Profile | community files 被 GitHub 识别 | Community Profile API 响应与 commit-pinned 文件链接 |
| Issue chooser | bug、feature、support/security routes 正确 | issue chooser 页面链接与配置读回 |
| Security reporting | private reporting 可用 | API `enabled: true` 与 advisory入口 |
| Dependabot | security updates 与两类 update config 生效 | API、Dependabot 配置识别结果与 PR/状态链接 |
| CodeQL | default setup configured 且 default branch analysis 成功 | default-setup API 与成功 run/analysis 链接 |
| main ruleset | active contract 与 repository 文件一致 | ruleset API 响应、ID 与普通 non-force 同步结果 |
| release tag | tag 不可移动且 commit 可从 `main` 到达 | tag ruleset、tag ref 与 ancestry 输出 |
| GitHub Release | `0.3.0-rc.2` prerelease notes 与 tag/commit 一致 | immutable release URL 与 API 响应 |
| npm | RC version、MIT、README、provenance、`rc` dist-tag、未改变的 `latest` 与 `gitHead` 一致 | registry、attestation 与 workflow verifier 输出 |

任一外部结果缺失、权限受限或不一致时，保持 Deployment ledger 未完成并显式报告阻塞；
不得使用推断、截图占位或成功形状 fallback。
