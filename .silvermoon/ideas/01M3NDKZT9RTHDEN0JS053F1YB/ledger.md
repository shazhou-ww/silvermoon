# Ledger

## Implementation

### Implementation steps

- [x] **I-S01:** 建立 inventory query 模型
- [x] **I-S02:** 提取可查询的 idea metadata
- [x] **I-S03:** 增加无 repository readiness gate 的本地观察
- [x] **I-S04:** 接入 CLI、API 与纯查询 renderer
- [x] **I-S05:** 更新操作指南与自动化证据

### Implementation acceptance criteria

- [x] **I-AC01:** 默认查询准确列出 active ideas
- [x] **I-AC02:** 过滤、排序与 limit 可预测组合
- [x] **I-AC03:** 无效参数在 repository 访问前失败
- [x] **I-AC04:** inventory 不受 repository hygiene 与同步阻塞
- [x] **I-AC05:** 纯查询输出完整且不伪造
- [x] **I-AC06:** 不可信项目或 layout 显式失败
- [x] **I-AC07:** 既有命令与文档保持一致

### Implementation evidence

- 2026-09-29：新增共享 lifecycle state 定义、纯 `idea-query` 模型和
  `listIdeas` command API；默认 active、重复 state 去重并集、literal query、
  RFC 3339 半开区间、ULID UTC 创建时间、同毫秒完整 ULID 稳定排序和
  post-sort limit 均由同一规范化入口实现。
- 2026-09-29：CLI、domain runtime 与 renderer 已接入统一
  `intention`/`observation`/`actions`/`response` report。成功查询使用
  `ideas-listed` observation、空 actions 和 `idea-list` response；可信
  setup/layout failure 退出 `1`，usage failure 在 Git、filesystem 与 trace
  访问前退出 `2`。
- 2026-09-29：9 项 inventory integration tests 覆盖默认与空集合、组合筛选、
  同毫秒与时间边界、limit、嵌套目录、staged/unstaged/untracked snapshot、
  detached/no-upstream/dirty 状态、无网络、无关 conflict、invalid layout、
  CLI JSON/Markdown 与退出码。新增 unit、schema、behavior manifest、
  documentation 和 package API contracts 均通过。
- 2026-09-29：README、getting started、operations、reference、repository
  task guide 与 canonical/generated Silvermoon skill 已同步。
  `pnpm test` 通过 65 项 unit 与 30 项 contract，`pnpm test:integration`
  通过 111 项并按 Windows 权限预期跳过 2 项，`pnpm test:e2e` 通过 1 项；
  Markdown lint、skill sync/check 和包含 46 个文件的 package allowlist 均通过。
  未创建 release tag，未执行 npm publish。

## Deployment

### Deployment steps

- [x] **D-S01:** 发布无发版部署契约
- [x] **D-S02:** 验证精确 primary commit 的托管 CI
- [x] **D-S03:** 复核无发版交付边界与 Silvermoon 导航

### Deployment acceptance criteria

- [x] **D-AC01:** 已验收实现与部署契约存在于 configured primary
- [x] **D-AC02:** 精确部署候选的 GitHub Actions CI 成功
- [x] **D-AC03:** deployment 不产生 release artifact 或发布动作
- [x] **D-AC04:** 发布后导航与 deployment revision 一致

### Deployment evidence

- 2026-09-29：无发版部署契约以普通 non-force commit
  `fa10d5f3dc35f07388219dfefe979577b34db35d` 发布到 `origin/main`；
  重新观察得到稳定 `deploymentRevision`
  `ace89b2d5596184ccf16c5cf9669d1ca88894666`。
- 2026-09-29：fresh `refs/heads/main` 精确指向
  `fa10d5f3dc35f07388219dfefe979577b34db35d`；Git ancestry 核验确认
  implementation commit `ec633e3aeea87c6cb7fa042a18d29b9ff279bba0`
  与 implementation acceptance commit
  `6531da416b7e6203873d8d001726263094e7d3f1` 都是该 commit 的祖先。
- 2026-09-29：GitHub Actions `CI` run
  https://github.com/shazhou-ww/silvermoon/actions/runs/36528124882 在 exact head
  `fa10d5f3dc35f07388219dfefe979577b34db35d` 上以
  `completed/success` 结束；repository contracts、Git integration 和 Linux、
  macOS、Windows 上的 Node.js 22/24 unit jobs 共 8 项全部成功。
- 2026-09-29：从 implementation acceptance commit 到部署契约 commit 的 diff
  仅包含本 idea 的 `Deployment.md` 与 `ledger.md`。remote 无 tag 指向相关
  commits，exact deployment commit 只有 `CI` push run；未修改 package version
  或发布 workflow，未创建 npm release tag，未 dispatch `publish-npm.yml`，
  未执行 npm publish。
- 2026-09-29：CI 完成后再次运行
  `silvermoon whats-next list-ideas --json`，成功 fetch exact primary commit，
  `problems` 为空，idea 保持 `deploying`，待验收 revision 仍精确为
  `ace89b2d5596184ccf16c5cf9669d1ca88894666`。
