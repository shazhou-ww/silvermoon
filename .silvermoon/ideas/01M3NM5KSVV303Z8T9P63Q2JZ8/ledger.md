# Ledger

## Implementation

### Implementation steps

- [x] **I-S01:** 定义 domain message 与 projection contracts
- [x] **I-S02:** 实现 observation reducer 与 actions projector
- [x] **I-S03:** 建立 functional core 与 imperative effect driver
- [x] **I-S04:** 以纯函数生成并渲染 response
- [x] **I-S05:** 整合 domain messages 与 performance trace
- [x] **I-S06:** 迁移 feature integrations、文档与测试
- [x] **I-S07:** 准备 0.2.0 RC implementation candidate
- [x] **I-S08:** 准备已验证 RC 之后的 stable implementation candidate

### Implementation acceptance criteria

- [x] **I-AC01:** 同一 domain stream 可确定性重建 report
- [x] **I-AC02:** Response 只依赖 intention 与 internal observation
- [x] **I-AC03:** Effect 执行与 action history 精确对应
- [x] **I-AC04:** 四字段 public report 覆盖全部命令
- [x] **I-AC05:** 默认输出 answer-first 且 stderr 保持纯净
- [x] **I-AC06:** Unified trace 保留性能并解释业务路径
- [x] **I-AC07:** Trace 不泄露完整 domain payload
- [x] **I-AC08:** 现有行为完成一致迁移
- [x] **I-AC09:** 0.2.0-rc.1 candidate 可供明确验收
- [x] **I-AC10:** Stable 0.2.0 implementation candidate 独立通过第二次验收门

### Implementation evidence

- 2026-09-29: ordered domain runtime、immutable reducer、actions projector、
  pure response、response-only renderer、四 projection schemas 与
  domain/telemetry unified trace 已完成；详细证据记录于
  `outer/inner/Implementation.md`。
- 2026-09-29: unit、contract、integration、pack、installed-package E2E、
  skill sync、schema fixtures、trace correlation/redaction 与 trace-on/off
  differential checks 通过；聚合 `pnpm check` 通过 61 unit、29 contract、
  104 integration（102 pass、2 skip）及 1 installed-package E2E，candidate
  CLI worktree check 与 `git diff --check` 通过。
- 2026-09-29: `0.2.0-rc.1` npm version 及 local/remote release tag 均不存在；
  candidate 未创建 tag、未执行 publish、未发布到 npm。
- 2026-09-29: RC `0.2.0-rc.1` 已按 Deployment evidence 发布和验证。用户明确同意
  返回 implementing 准备 stable candidate；新增 I-S08/I-AC10 以限定版本变更、
  验证和再次 acceptance gate。Stable manifest 与发布尚未处理。
- 2026-09-29: Stable implementation candidate 将 manifest 更新为 `0.2.0`；
  经检索没有额外 exact-version install assertion 需要同步，RC 发布命令示例保留为
  历史 prerelease 指令。Candidate commit
  `b768aeda26508b5651ae7211d84d6cbae77c1e98` 已发布到 `main`，Silvermoon
  remote snapshot 通过且仍报告 implementing；精确 Implementation revision 为
  `4d8bd5c4bf990096602f9b6e60a34bbac61fb7cf`，对应
  [Implementation.md](https://github.com/shazhou-ww/silvermoon/blob/b768aeda26508b5651ae7211d84d6cbae77c1e98/.silvermoon/ideas/01M3NM5KSVV303Z8T9P63Q2JZ8/outer/inner/Implementation.md)。
  Frozen install、完整
  `pnpm check`（65 unit、30 contract、113 integration；111 pass、2 Windows
  symlink permission skips）、pack（46 files）及 installed-package E2E 通过。
  Stable release planner 对该 main commit 返回 `publicationState: absent`、
  `distTag: latest`；未创建 `npm/silvermoon/v0.2.0` tag、未执行 stable publish，
  也未记录新的 implementation acceptance。

## Deployment

### Deployment steps

- [x] **D-S01:** 确认 RC 发布前提与显式授权
- [x] **D-S02:** 发布不可变的 0.2.0 RC
- [x] **D-S03:** 在真实消费者中验证 RC
- [x] **D-S04:** 处理 RC 缺陷或确认稳定候选
- [ ] **D-S05:** 重新验收 0.2.0 stable implementation
- [ ] **D-S06:** 发布并验证稳定 0.2.0
- [ ] **D-S07:** 请求最终 deployment acceptance

### Deployment acceptance criteria

- [x] **D-AC01:** RC 在 stable 之前发布且不影响 latest
- [x] **D-AC02:** RC 真实验证新的 command runtime
- [x] **D-AC03:** Phase guidance 与既有安全边界不回归
- [ ] **D-AC04:** RC 失败只产生新的不可变候选
- [ ] **D-AC05:** Stable candidate 经第二次 implementation gate
- [ ] **D-AC06:** Stable 0.2.0 独立发布并完整验证
- [ ] **D-AC07:** 最终验收证据完整可追溯

### Deployment evidence

- 2026-09-29: npm registry 未列出 `0.2.0-rc.1`；`latest` 仍为 `0.1.3`，
  `rc` 仍为 `0.1.3-rc.4`。本地与远端均未发现
  `npm/silvermoon/v0.2.0-rc.1` tag。当前 `origin/main` 为
  `a28bc9d0bfbb75b3fc5ea6d142e77aa6e3ca3cf6`，其 package manifest 版本为
  `0.2.0-rc.1`，idea 状态为 deploying 且已记录 implementation acceptance。
- 2026-09-29: 用户在当前 session 明确调用 `/publish silvermoon 0.2.0-rc.1`。
  发布 workflow 已核实使用 GitHub-hosted Ubuntu runner、`id-token: write`、
  Node 24、npm 11.6.2 和 npmjs `registry-url`。`pnpm install --frozen-lockfile`
  与 `pnpm check` 通过：65 unit、30 contract、113 integration（111 pass、
  2 Windows 权限限制 skip）及 installed-package E2E 通过；pack candidate 为
  `silvermoon@0.2.0-rc.1`。发布授权已满足，但仍须在刷新 `main`/tags 后再次
  验证 commit 可达性、目标版本/tag 缺失并运行 release planner，才可创建 tag。
- 2026-09-29: 不可变 tag `npm/silvermoon/v0.2.0-rc.1` 指向
  `fcc881a6a5e7b7f2aad283f3b151a4c15fd6f400`，GitHub Actions run
  [36530022721](https://github.com/shazhou-ww/silvermoon/actions/runs/36530022721)
  成功。`VERIFY_NPM_RELEASE_OK` 确认 registry tarball 与唯一候选一致：
  SHA-256 `b920eb38d403ed939ac9d3d457a9d1fa7cc07d5f6edd2a72972a5756c29ecc89`、
  integrity `sha512-7ZTG0pDu/kswHsXWuCx/ohOFqxBmjpNKhvpQ6bHPASWFw85qL9G24bSolqj9wmkDeYROjTnpxdr9tWX6oi+Sbg==`、
  46 个文件、`gitHead` 与 tag commit 相同。npm `rc` 指向 `0.2.0-rc.1`，
  `latest` 保持 `0.1.3`；npm publish 与 SLSA provenance 均已验证，
  provenance invocation 为
  https://github.com/shazhou-ww/silvermoon/actions/runs/36530022721/attempts/1。
  Commit-pinned jsDelivr assets：
  [silvermoon.svg](https://cdn.jsdelivr.net/gh/shazhou-ww/silvermoon@fcc881a6a5e7b7f2aad283f3b151a4c15fd6f400/assets/silvermoon.svg)、
  [silvermoon-avatar.svg](https://cdn.jsdelivr.net/gh/shazhou-ww/silvermoon@fcc881a6a5e7b7f2aad283f3b151a4c15fd6f400/assets/silvermoon-avatar.svg)。
  活跃 tag ruleset `Protect npm release tags` 覆盖 `npm/**` 并禁止创建、更新及删除；
  GitHub push 确认本次创建使用当前身份在该规则中的显式 bypass 权限。
- 2026-09-29: 在干净临时消费者分别执行 `npm install silvermoon@0.2.0-rc.1`
  与 `npm install silvermoon@rc`，两者均解析到 `0.2.0-rc.1`。再分别从 npm
  下载的精确版本 tarball 和 `@rc` tarball 运行完整 installed-package E2E，
  两轮均通过，覆盖 `whats-next`、`create-idea`、`check`、`list-ideas`、
  四 projection JSON、response-only Markdown、phase guidance 与预期失败。
  直接从已安装 `@rc` CLI 对 `list-ideas` 执行 trace on/off differential：
  public report 相同、stderr 为空；33 条统一 JSONL 含 3 条 domain events 和
  15 对 telemetry spans，序号连续且 durations 有效，敏感 query
  canary 未进入 trace。3 次测量中位数为 trace off 1314.12 ms、trace on
  1245.55 ms。完整 `pnpm check` 的 trace schema、event correlation、
  redaction、hostile guidance、repository readiness、SHA-1/SHA-256 与包装测试
  亦全部通过（仅 2 项 Windows symlink 权限用例按预期跳过）。
- 2026-09-29: RC 无已知 source、manifest、contract、performance 或 external
  verification defect；用户明确要求按 D-S04 从已验证 RC 返回 implementing，
  为 stable `0.2.0` 准备独立 implementation candidate。RC tag/package 保持不可变；
  本次未更改 status acceptance facts、未创建 stable tag、未发布 stable package。
