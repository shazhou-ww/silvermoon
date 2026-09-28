# 批处理 Git 观察以降低 Silvermoon 响应延迟

## Intent

让 `whats-next`、`create-idea` 与 `check` 在 idea 数量增长时仍能快速完成项目观察，
避免为每个 world 和 revision 重复启动短命 Git 进程，同时保持现有 snapshot、
并发保护与只读语义。

## Context

`--trace` 对当前包含 14 个 ideas 的仓库给出了可复现基线：一次未进入远端访问的
`whats-next` 总耗时约 24.64 秒，其中 `idea-layout.inspect` 约 23.96 秒。
该阶段启动 248 个 Git 子进程；仅 42 个 world tree 的计算就通过
`read-tree`、`add`、`write-tree`、`rev-parse` 和 `cat-file` 启动 210 个进程，
另有 37 次独立的 revision object 类型检查。在 Windows 上，每个短命进程约需
96 毫秒，进程启动成本因此主导整体延迟。这份 trace 是修复 snapshot-only check
之前的历史基线；后续语义修复已经删除旧 revision object 与 history 检查，因此实现
性能优化前必须重新采集当前基线，不能把自然减少的命令计为本 idea 的优化收益。

primary 观察还会先执行 `ls-remote`，再无条件执行 `fetch`。两者分别建立网络连接，
即使远端未移动也产生两次往返。Git fetch 已能取得 advertised tip，因此这里存在
进一步消除重复网络握手的机会。

## Desired outcome

- 一个待检查 snapshot 只构造一次临时 index/tree；所有 idea 的三个 world revision
  从同一个不可变 snapshot 批量解析。
- primary tip 的获取与对象传输通过一次 fetch 观察完成，不再先做独立
  `ls-remote`，且结果仍是本次调用使用的精确 immutable commit。
- 命令输出、idea state、diagnostics、snapshot target 和失败语义保持不变；优化前后
  对同一输入得到相同业务结果。
- trace 能证明 Git 子进程数和关键阶段耗时显著下降，并清楚区分本地观察与网络成本。
- 所有 CLI trace 输出都使用小写 `.trace.jsonl` suffix：若 `--trace` 参数尚未以该
  suffix 结尾，则在保留目录与原文件名的前提下自动追加；已匹配的路径不重复追加。
- repository 通过 `*.trace.jsonl` 忽略这些本地诊断文件，CLI help、reference 与
  examples 使用同一命名约定，使按约定生成的 trace 不再阻塞 Silvermoon hygiene。

## Scope

### In scope

- 重构 worktree、index、commit 和 remote snapshot 的内部构造与复用方式。
- 批量读取所有 idea 的 world tree object ID。
- 消除 `fetchPrimary` 中独立的 `ls-remote` 网络往返，同时保持 remote branch
  移动时的可靠观察。
- 为不同 idea 数量和所有 validation targets 增加命令计数、结果等价性及无副作用测试。
- 使用 `--trace` 在同一仓库、同一机器和可比 Git 状态下记录优化前后基线。
- 在 CLI 边界规范化 `--trace` 文件名、添加 `*.trace.jsonl` ignore rule，并覆盖
  已有 suffix、缺少 suffix、相对路径、绝对路径及 exclusive-create 行为。

### Out of scope

- 不改变 `whats-next` 默认是否访问 primary，也不在本 idea 引入缓存、TTL、
  `--offline` 或 `--force-sync` 策略。
- 不改变 snapshot-only `check` 的项目契约、status decision 语义或 lifecycle
  推导方式，也不重新引入已经删除的 transition/provenance 检查。
- 不通过常驻 daemon、长期后台进程或共享可变全局 cache 隐藏单次调用成本。
- 不降低 symlink、canonical YAML、current world tree 或 immutable snapshot
  检查强度。
- 不忽略任意 `.jsonl` 文件，也不重命名、删除或提交用户已有的 trace。

## Constraints

- 不移动或创建调用者的 branch、named ref、index、worktree 或 stash；临时资源必须
  在成功和失败路径都清理。
- 保留 SHA-1 与 SHA-256 repository 支持、无 named remote 的 repository URL fetch，
  以及 Windows、macOS、Linux 行为。
- 错误必须保留具体原因，不能用缓存成功、陈旧 commit 或空结果掩盖 fetch、
  object lookup 或 snapshot materialization 失败。
- suffix 匹配采用精确的小写 `.trace.jsonl`；例如 `--trace logs/whats-next` 写入
  `logs/whats-next.trace.jsonl`，而 `--trace logs/whats-next.trace.jsonl` 保持不变。
  suffix 规范化后仍使用 exclusive creation，既有目标文件必须显式报错而非覆盖。
- 性能验收以 Git 子进程数这一确定指标为主，以同环境 trace duration 为辅，避免把
  外部网络波动或机器性能写成不可移植的绝对产品承诺。
- 在当前 14-idea repository 的新基线上，`idea-layout.inspect` 的 Git 子进程必须
  降到不超过 10 个；同环境阶段耗时应至少下降 80%。新基线和优化后 trace 必须使用
  相同 snapshot-only 代码语义。若实现需要突破此上限，必须用 trace 证明不可合并的
  语义边界并在契约中重新获得批准。
