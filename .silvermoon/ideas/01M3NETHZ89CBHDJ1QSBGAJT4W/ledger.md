# Ledger

## Implementation

### Implementation steps

- [x] **I-S01:** 建立 phase guidance layout 与读取器
- [x] **I-S02:** 为按需与完整检查提供独立验证模式
- [x] **I-S03:** 在 whats-next 最终阶段结果中附带 guidance
- [x] **I-S04:** 在 create-idea 成功路径附带 preparing guidance
- [x] **I-S05:** 隔离渲染并更新 Agent 消费规则
- [x] **I-S06:** 文档化契约并建立完整测试矩阵
- [x] **I-S07:** 消除 canonical skill 的跨平台换行误差

### Implementation acceptance criteria

- [x] **I-AC01:** 缺省项目完全兼容
- [x] **I-AC02:** guidance 只随最终当前阶段交付
- [x] **I-AC03:** 输出内容与 snapshot 可验证绑定
- [x] **I-AC04:** 追加指导不能覆盖核心协议
- [x] **I-AC05:** 按需失败不污染其他阶段
- [x] **I-AC06:** check 完整验证所有 guidance
- [x] **I-AC07:** 内容不被解释、泄露或隐式持久化
- [x] **I-AC08:** 文档、skill 与发布级检查一致
- [x] **I-AC09:** 发布包 skill 校验不受 Git 换行转换影响

### Implementation evidence

- 2026-09-29: Git tree/blob reader 覆盖固定路径、32 KiB、UTF-8、BOM、NUL、
  空白、regular file/symlink、CRLF 与 SHA-1/SHA-256 object format。
- 2026-09-29: whats-next、create-idea、check 与 renderer tests 覆盖按需读取、
  readiness 顺序、snapshot 竞态、错误隔离、canonical instructions 分离和
  全 target validation。
- 2026-09-29: canonical/generated skill、公开文档、package manifest 与
  installed-package smoke 已同步验证。
- 2026-09-29: 最终候选通过 `pnpm check`、`pnpm check:skills`、
  `git diff --check`、`silvermoon check --worktree` 与
  `silvermoon check --staged`。
- 2026-09-29: `silvermoon@0.1.3-rc.1` registry tarball
  (`gitHead` `49c437ca46822d97066c924b2167b45d5c7c5e15`，integrity
  `sha512-hAy0GpqBKOA8lwFwMey7+72lL//PbOfsxEdMRTHKoFveaX51f0LlcMMQg0rrJcfpH5YVCsBRuHxHxAn8qO52Ug==`)
  包含 phase guidance；隔离 consumer 的 16 项功能与边界矩阵通过。
- 2026-09-29: 仓库 installed-package E2E 使用同一 registry tarball 时在
  Windows `core.autocrlf=true` 下失败为 `canonical-skill-mismatched`；将同一
  consumer 的 `core.autocrlf` 改为 `false` 后通过。D-AC06 因此尚未满足，需
  修复后发布新版本并重新运行部署矩阵。
- 2026-09-29: canonical skill digest 现仅统一有效 UTF-8 文本的 CRLF/LF，
  其他内容仍逐字节校验。反向换行 unit fixture、五种 snapshot target
  integration regression 和强制 `core.autocrlf=true` 的 installed-package
  E2E 均通过；完整 `pnpm check`、`pnpm check:skills`、`git diff --check` 与
  `silvermoon check --worktree` 通过。

## Deployment

### Deployment steps

- [ ] **D-S01:** 发布明确授权的 Silvermoon 版本
- [ ] **D-S02:** 在真实项目验证三个阶段的指导交付
- [ ] **D-S03:** 验证缺省、阻塞与恶意内容边界

### Deployment acceptance criteria

- [ ] **D-AC01:** 已发布 CLI 可按阶段交付项目指导
- [ ] **D-AC02:** 更高优先级动作与终止状态不泄露 guidance
- [ ] **D-AC03:** guidance 缺省兼容且错误按作用域阻塞
- [ ] **D-AC04:** 项目 Markdown 保持数据边界
- [ ] **D-AC05:** 项目要求仍由 world revision 与人类决定承载
- [ ] **D-AC06:** 已发布版本保持既有命令兼容
