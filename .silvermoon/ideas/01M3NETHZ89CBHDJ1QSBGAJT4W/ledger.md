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

- [x] **D-S01:** 发布明确授权的 Silvermoon 版本
- [x] **D-S02:** 在真实项目验证三个阶段的指导交付
- [x] **D-S03:** 验证缺省、阻塞与恶意内容边界

### Deployment acceptance criteria

- [x] **D-AC01:** 已发布 CLI 可按阶段交付项目指导
- [x] **D-AC02:** 更高优先级动作与终止状态不泄露 guidance
- [x] **D-AC03:** guidance 缺省兼容且错误按作用域阻塞
- [x] **D-AC04:** 项目 Markdown 保持数据边界
- [x] **D-AC05:** 项目要求仍由 world revision 与人类决定承载
- [x] **D-AC06:** 已发布版本保持既有命令兼容

### Deployment evidence

- 2026-09-29: 用户明确授权把已发布的稳定版 `silvermoon@0.1.3`
  作为本 idea 的部署目标并取消过时的 `0.1.3-rc.5` 发布。不可变 tag
  `npm/silvermoon/v0.1.3` 指向从 `origin/main` 可达的
  `36f91ea380cfbe132eeda6431dfc81ed6b542557`；受保护 trusted-publishing
  workflow run `36521754553` 成功。
- 2026-09-29: npm registry 元数据的 version 与 `gitHead` 分别为 `0.1.3`
  和 `36f91ea380cfbe132eeda6431dfc81ed6b542557`，integrity 为
  `sha512-f8aHS4ob8yntOyZvtps/3g1pBT0L/Imlq9u2/d5IOCStQpm+zzWSWbuGyJD/0qzUGYr6iaIOsXd2xx6gq7l1fw==`，
  且 registry provenance 存在。registry tarball 的 installed-package E2E
  在 Windows `core.autocrlf=true` consumer 中通过。
- 2026-09-29: 隔离 consumer 针对同一 registry tarball 的 16 场景矩阵全部
  通过。preparing、implementing、deploying 只交付当前 actionable phase；
  `create-idea` 成功路径交付 preparing guidance；JSON/Markdown 的 phase、
  path、content revision 与 content 一致，并与所选 snapshot 的 Git blob
  核对一致，language override 不翻译项目内容。
- 2026-09-29: bare/unknown selector、completed/abandoned、project setup、
  dirty/upstream/fetch 等更高优先级状态均不读取或泄露 guidance。无 guidance
  与缺失当前 phase 保持兼容；其他 phase 无效不阻断当前 `whats-next`，当前
  phase 无效给出作用域明确的问题并使 `create-idea` 在写 scaffold 前停止；
  worktree、staged、HEAD、commit 与 remote 的 `check` 均验证各自 snapshot。
- 2026-09-29: hostile headings、fences、模板、URL 与命令片段只作为 inert
  Markdown 数据返回；没有执行 sentinel 命令，本地 HTTP probe 收到 0 个请求，
  trace 不含 guidance 正文，报告 section 和文件树保持隔离。
- 2026-09-29: guidance blob revision
  `e08d46f6e4ec5ab24055c0aa357933bc9eaa5b93` 本身不改变 status 或 world
  revision；只有把适用要求写入当前 world contract 与 ledger 后，outer
  revision 才从 `c4e7d8408570d0978f9914e480fbe2da0b7d92d3` 变为
  `69715e0d357b0b47eae0d025af7eab07d5f0a5e8`，且 status 不变。
