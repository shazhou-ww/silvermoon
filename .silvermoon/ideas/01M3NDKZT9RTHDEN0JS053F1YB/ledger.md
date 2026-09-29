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

- [ ] **D-S01:** 发布无发版部署契约
- [ ] **D-S02:** 验证精确 primary commit 的托管 CI
- [ ] **D-S03:** 复核无发版交付边界与 Silvermoon 导航

### Deployment acceptance criteria

- [ ] **D-AC01:** 已验收实现与部署契约存在于 configured primary
- [ ] **D-AC02:** 精确部署候选的 GitHub Actions CI 成功
- [ ] **D-AC03:** deployment 不产生 release artifact 或发布动作
- [ ] **D-AC04:** 发布后导航与 deployment revision 一致
