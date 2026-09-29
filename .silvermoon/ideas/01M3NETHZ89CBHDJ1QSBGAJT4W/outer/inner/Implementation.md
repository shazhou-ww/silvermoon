# Implementation

## Steps

### I-S01: 建立 phase guidance layout 与读取器

集中定义 preparing、implementing、deploying 到固定 Markdown 路径的映射，并
实现 snapshot-aware reader。读取器区分 absent、valid 和 invalid，验证目录、
regular file/symlink、允许的 entry、32 KiB、UTF-8、BOM、NUL 与非空内容，
规范化 CRLF 展示，并返回 phase、relative path、Git blob object ID 和正文。

### I-S02: 为按需与完整检查提供独立验证模式

让 lifecycle commands 能只读取一个当前阶段，而 `check` 能枚举并验证整个
guidance 目录。两种模式复用同一验证原语和 diagnostic codes，但按需模式不因
其他阶段或额外 entry 抢占当前 action；完整模式在 HEAD、worktree、staged、
commit、remote snapshot 上拒绝任一结构或内容错误。

### I-S03: 在 whats-next 最终阶段结果中附带 guidance

保持现有 project/repository readiness、fetch、ancestry 和 selector 顺序。
只有 selector 已解析为 preparing/implementing/deploying 且同步就绪后，才从
同一 snapshot 加载对应 guidance。有效文件进入 observation 的独立结构字段，
缺失时保持旧 shape；无效时返回明确 problem 和修复指令，不输出 lifecycle
成功指令或其他阶段内容。

### I-S04: 在 create-idea 成功路径附带 preparing guidance

保持 create 的 project 与 local repository preflight。在 preflight 通过后、
任何目录或 scaffold 写入前读取 preparing guidance；无效时安全停止，缺失时
保持旧行为，有效时让成功 observation 同时携带新 idea 与同一 local HEAD
snapshot 的 guidance。

### I-S05: 隔离渲染并更新 Agent 消费规则

扩展 JSON/Markdown renderer，保持既有顶层 envelope 与 canonical instructions，
将 guidance 以独立 section 和明确 provenance 输出。正文使用不会逃逸报告层级
的 blockquote 渲染；输出语言只作用于 framing。更新 canonical skill 及生成
副本，使 Agent 只消费报告内 guidance、遵守固定优先级、显式处理冲突，并把
适用要求写入当前 world contract 与 ledger。

### I-S06: 文档化契约并建立完整测试矩阵

更新 core concepts、operations、reference、getting started、README、schema
职责说明与 CLI examples。增加 reader、snapshot、dialogue、create、whats-next、
check、skill contract 和 installed-package E2E，覆盖文件缺省、三个阶段、
readiness ordering、内容边界、SHA-1/SHA-256、双语 framing 与全部 check
targets，并运行 release-grade 检查。

### I-S07: 消除 canonical skill 的跨平台换行误差

部署验证发现，从 Git blob 打包的 LF canonical skill 在
`core.autocrlf=true` 的 Windows consumer 中会被 snapshot checkout 转为
CRLF，导致内容未变化却报告 `canonical-skill-mismatched`。canonical skill
digest 必须把有效文本的 CRLF/LF 视为等价，同时继续逐字节拒绝其他文本变化和
二进制变化；增加跨平台 unit 与 installed-package regression coverage。

## Acceptance criteria

### I-AC01: 缺省项目完全兼容

没有 `.silvermoon/guidance` 或缺少当前阶段文件时，`whats-next`、
`create-idea` 和全部 `check` target 的 observation、instructions、退出码与
side effects 保持既有行为，且不出现空 guidance 字段或文本 section。通过现有
exact-shape suites 与无 guidance 的 installed-package fixture 证明。

### I-AC02: guidance 只随最终当前阶段交付

选中 preparing、implementing、deploying idea 时分别只附带同名文件；
`create-idea` 成功时只附带 preparing。裸导航、selector miss、setup/hygiene/
sync/fetch 阻塞以及 completed/abandoned 都不读取或输出 guidance。通过禁止
reader 调用的 spies 和覆盖全部 observation states 的 integration matrix 证明。

### I-AC03: 输出内容与 snapshot 可验证绑定

有效 guidance 的 JSON 含准确 phase、repository-relative path、Git
`contentRevision` 和原文；Markdown 在 canonical 下一步之后显示相同 metadata，
并将每一行隔离为 blockquote。修改路径后的文件不能改变已形成报告，SHA-1 与
SHA-256 repository 都产生正确 object ID。通过 blob hash、race fixture、
JSON/text parity 和 Markdown injection cases 证明。

### I-AC04: 追加指导不能覆盖核心协议

报告中的 canonical instructions 与 project guidance 始终结构化分离，skill
明确规定前者优先、冲突时不执行项目冲突部分并向用户说明。guidance 要求只有
写入对应 world contract 与 ledger 后才成为 idea-specific 可审查内容，且不会
自行写 status 或证明检查完成。通过 skill contract assertions 和代表性 Agent
scenario/evaluation 证明。

### I-AC05: 按需失败不污染其他阶段

当前阶段文件存在但为 directory/symlink、超过 32 KiB、无效 UTF-8、含 BOM/NUL
或仅空白时，`whats-next` 返回明确 guidance problem 而非 lifecycle 成功指令；
`create-idea` 在写入任何路径前返回问题。另一个阶段的同类错误不阻止当前
lifecycle command。通过每类 fixture、filesystem spy 和创建前后树对比证明。

### I-AC06: check 完整验证所有 guidance

HEAD、worktree、staged、commit 和 remote checks 对对应 snapshot 中三个约定
文件及 guidance directory 的额外 entry 执行完整验证；任一错误产生稳定
diagnostic、退出 `1` 且无 partial-success fallback。目录/文件全缺失通过。
通过全 target matrix、不同 snapshot 内容和 remote isolation assertions 证明。

### I-AC07: 内容不被解释、泄露或隐式持久化

Markdown 中的 frontmatter、模板语法、URL、shell snippet 和 headings 只作为
原文返回，不触发插值、include、网络或命令执行；preferred/override language
不翻译正文。trace 与内部错误不包含 guidance content。通过 hostile-content、
network/process spies、双语输出和 trace inspection 证明。

### I-AC08: 文档、skill 与发布级检查一致

文档和 CLI contract 明确固定路径、追加优先级、按需输出、完整 check 与
materialization 责任；canonical/generated skill 内容一致。`pnpm check`、
`pnpm check:skills`、Markdown links、package/installed E2E、
`git diff --check`、`silvermoon check --worktree` 与 staged check 全部通过。

### I-AC09: 发布包 skill 校验不受 Git 换行转换影响

从 registry-style tarball 安装 Silvermoon、用支持的 `skills add` 命令注册
canonical skill，并在 `core.autocrlf=true` repository 中提交后，HEAD、
worktree、staged、commit 与 remote check 均保持 `project-ready`。仅 CRLF/LF
转换可等价；任一其他内容变化仍产生 `canonical-skill-mismatched`。通过反向
换行 unit fixture、Windows installed-package E2E 和真实 registry consumer
复验证明。

## Verification evidence

- `src/guidance.js` 与 `src/git.js` 从选定 Git tree 读取固定 entry、验证 blob
  原始字节并返回同一 blob 的 object ID；`src/observation.js` 对全部 check
  snapshot 执行完整目录验证。
- `src/whatsnext.js` 与 `src/create-idea.js` 只在当前 actionable phase 成为最终
  动作后附带 guidance；`src/dialogue.js` 将 canonical instructions 与
  repository-owned Markdown 分段呈现。
- `test/integration/guidance.test.js`、command integration、dialogue contract 与
  installed-package E2E 覆盖缺省兼容、三阶段、失败边界、SHA-1/SHA-256、竞态、
  双语 framing、trace 隔离及全部 check targets。
- 2026-09-29 的最终候选通过 `pnpm check`、`pnpm check:skills`、
  `git diff --check`、`silvermoon check --worktree` 与
  `silvermoon check --staged`。
- 2026-09-29 部署 `silvermoon@0.1.3-rc.1` 后，真实 registry tarball 在
  Windows `core.autocrlf=true` consumer 的 HEAD check 中把已注册且文件内容
  相同的 skill 误报为 `canonical-skill-mismatched`；将 repository-local
  `core.autocrlf` 改为 `false` 后同一 snapshot 通过，确认是 snapshot checkout
  的换行转换而不是 skill 漂移。
- `src/adoption.js` 只为不含 NUL 且可解码为 UTF-8 的 canonical skill 文本统一
  CRLF/LF 后计算 digest；其他字节保持原样，因此真实文本或二进制漂移仍失败。
- unit regression 使用与运行包相反的文本换行，integration regression 覆盖
  HEAD、worktree、staged、commit 与 remote，installed-package E2E 强制
  `core.autocrlf=true`。修复候选再次通过 `pnpm check`、`pnpm check:skills`、
  `git diff --check` 与 `silvermoon check --worktree`。
