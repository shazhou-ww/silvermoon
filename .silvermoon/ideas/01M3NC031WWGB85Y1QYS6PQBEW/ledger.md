# Ledger

## Implementation

### Implementation steps

- [x] **I-S01:** 建立根级公开资产契约
- [x] **I-S02:** 生成 commit 固定的 jsDelivr README
- [x] **I-S03:** 构建并发布单一 tarball
- [x] **I-S04:** 加强发布编排与外部核验
- [x] **I-S05:** 覆盖发布合同并完成仓库验证

### Implementation acceptance criteria

- [x] **I-AC01:** 公开资产路径一致且向后兼容
- [x] **I-AC02:** 发布 README 只引用不可变资源
- [x] **I-AC03:** 验证与发布使用同一 tarball
- [x] **I-AC04:** 主分支发布信任边界保持不变
- [x] **I-AC05:** 完整候选通过 release-grade 验证

### 实现证据

- 2026-09-29：canonical 头像已加入 `assets/silvermoon-avatar.svg`，历史
  `docs/assets/silvermoon-avatar.svg` 保留为普通文件兼容副本；两者 SHA-256
  均为 `189F8EC740EB8469F96360E5E38121ED4A15C250D39747020EA668B818C5EF33`。
  `node --test "test/contract/assets.test.js"`、`pnpm pack:check` 与
  `pnpm test:e2e` 通过，证明 SVG 安全性与明暗主题对比度、双路径字节一致性、
  package allowlist 和安装后内容一致性。
- 2026-09-29：两份仓库 README 的主视觉与头像均改用根级资产的 GitHub-backed
  jsDelivr `@main` URL；npm README generator 将本仓库 jsDelivr 与旧
  raw GitHub `main` 引用固定到指定完整提交，并拒绝缺失 ref、`HEAD`、其他
  分支或标签、错误提交、相对图片及可移动 GitHub 文件 URL。聚焦的 18 项单元、
  集成与契约测试通过，真实 README 的生成结果仅引用指定提交，且源文件在生成
  前后保持字节不变。
- 2026-09-29：publish workflow 在 `git archive` staging 中生成 README，
  `build-npm-tarball.mjs` 只调用一次实际 `npm pack`，校验并记录 tarball
  绝对路径、SHA-256、npm shasum、SHA-512 integrity 与排序文件清单。内容检查
  使用该 `.tgz` 的 `npm pack --dry-run --json` 结果，安装后 E2E 在收到
  `SILVERMOON_TARBALL` 时不再自行打包，最终 publish 命令显式接收同一路径。
  内容检查对照记录的 SHA-256 与 npm integrity，publish 紧邻执行前再次校验
  SHA-256。本地端到端演练生成且保留一份实际 tarball，38 个文件通过
  `PACK_OK` 与 `PACK_SMOKE_OK`。
- 2026-09-29：release planner 保留刷新后 `origin/main` ancestry 与
  `npm/<release-key>/v<version>` allowlist，并将 registry 状态显式输出为
  `absent` 或 `published`；精确版本重跑会跳过 publish，但仍必须通过完整候选
  比对。新增发布后 verifier，逐项核对 version、dist-tag、tarball 字节与
  integrity、文件数、npm package-level README、两份 tarball README、npm
  publish/SLSA attestations、tag commit 及两个 jsDelivr SVG。发布 workflow、
  维护文档和 publish skill 已同步，15 项聚焦 release 测试通过。
- 2026-09-29：最终覆盖显式拒绝 registry `gitHead` 或 SLSA provenance
  dependency 指向不同 commit。`pnpm check` 通过 55 项 unit、24 项 contract、
  80 项 integration（78 通过，2 项因 Windows 权限按预期跳过）及 1 项安装后
  E2E；独立执行 `pnpm check:skills`、`pnpm lint:markdown`、
  `pnpm pack:check` 和 `pnpm test:e2e` 也全部通过。包内容检查确认 38 个文件
  及 SHA-512 integrity，最终候选同时通过 `git diff --check` 与
  `silvermoon check --worktree --json`，既有 CLI、schema 与 lifecycle 测试
  均保持通过。

## Deployment

### Deployment steps

- [x] **D-S01:** 通过受保护标签发布明确授权的版本
- [x] **D-S02:** 核对注册表与发布产物身份
- [x] **D-S03:** 验证公开 README 与资产兼容性

### Deployment acceptance criteria

- [x] **D-AC01:** 发布来源可追溯到受保护主分支
- [x] **D-AC02:** 注册表提供经过验证的同一产物
- [x] **D-AC03:** 公开 README 使用不可变 CDN 资源
- [x] **D-AC04:** 历史资产 URL 保持可用

### 部署证据

- 2026-09-29：不可变 tag `npm/silvermoon/v0.1.3` 指向
  `36f91ea380cfbe132eeda6431dfc81ed6b542557`，该提交可从刷新后的
  `origin/main` 到达。GitHub tag ruleset `Protect npm release tags`
  处于 active 状态，覆盖 `refs/tags/npm/*/*` 并限制创建、更新和删除。
  `Publish npm package` workflow run
  [`36521754553`](https://github.com/shazhou-ww/silvermoon/actions/runs/36521754553)
  的 tag、head commit 和 provenance invocation 完全一致，全部步骤成功；
  SLSA payload 同时绑定 repository、`.github/workflows/publish-npm.yml`、
  tag ref、Git commit 和 GitHub-hosted builder。
- 2026-09-29：canonical npm registry 将 `latest` 指向 `0.1.3`，版本元数据的
  `gitHead` 为发布提交。下载 tarball 的 SHA-256 为
  `8fad3cca22a5917a826df2a60b1754102f17eacf905bf955b8e89aa9cac57d95`，
  shasum 为 `7cca9b8a4dd547ef644fd267ba85fde0a9c35dba`，integrity 为
  `sha512-f8aHS4ob8yntOyZvtps/3g1pBT0L/Imlq9u2/d5IOCStQpm+zzWSWbuGyJD/0qzUGYr6iaIOsXd2xx6gq7l1fw==`；
  三者与 workflow 唯一候选和 registry 元数据一致。39 个文件通过发布 tag
  的 package allowlist 和安装后 E2E，独立 verifier 再次输出
  `VERIFY_NPM_RELEASE_OK`。
- 2026-09-29：registry package-level README 与 tarball `README.md`
  字节一致；英文和中文 README 均包含发布提交固定的主视觉及头像 jsDelivr
  URL，且不含 `@main`、`HEAD` 或 raw GitHub 可移动资源。npm `0.1.3`
  页面实际显示并成功加载两张图片，同时公开显示同一 workflow、source commit
  与 Sigstore transparency entry。
- 2026-09-29：历史 raw GitHub 主视觉和 `docs/assets` 头像 URL 均返回
  HTTP 200 与 `image/svg+xml`，其 SHA-256 分别为
  `b60395a15bf57ed2f8e3ae41a7d29681d44b101626690962fa9bd7a802816796`
  和 `116e6dd7e6a651648a776c660d420fc68f6534d2a4c7e3965c80e423ae18ed58`，
  与 `0.1.3` tarball canonical 资产逐字节一致；npm `0.1.0` 历史页面的
  主视觉和头像也仍可见并成功加载。
