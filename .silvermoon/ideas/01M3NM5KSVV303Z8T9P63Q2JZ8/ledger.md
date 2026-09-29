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

## Deployment

### Deployment steps

- [x] **D-S01:** 确认 RC 发布前提与显式授权
- [ ] **D-S02:** 发布不可变的 0.2.0 RC
- [ ] **D-S03:** 在真实消费者中验证 RC
- [ ] **D-S04:** 处理 RC 缺陷或确认稳定候选
- [ ] **D-S05:** 重新验收 0.2.0 stable implementation
- [ ] **D-S06:** 发布并验证稳定 0.2.0
- [ ] **D-S07:** 请求最终 deployment acceptance

### Deployment acceptance criteria

- [ ] **D-AC01:** RC 在 stable 之前发布且不影响 latest
- [ ] **D-AC02:** RC 真实验证新的 command runtime
- [ ] **D-AC03:** Phase guidance 与既有安全边界不回归
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
