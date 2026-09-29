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
