# 用 Trace 系统优化 Silvermoon 子命令性能

## 意图

以可重复的 `--trace` 证据优化 `list-ideas`、`whats-next`、
`create-idea` 和 `check` 的端到端命令工作，在不削弱仓库观察、
fresh primary、snapshot 隔离和失败语义的前提下，减少可避免的
本地 Git 子进程、重复 snapshot 物化、无效 metadata 读取与测量盲区。

## 背景

2026-09-30 的同机调研在一个包含 32 个 ideas、其中 2 个 active ideas
的干净 clone 上进行。每条最终路径先 warm-up，再采集 5 份独立 trace
并比较中位数；完整方法、基线、瓶颈和建议见
[CLI 子命令性能调研](./performance-research.md)。

当前主要成本不是命令自身的业务动作：

- `list-ideas` 的中位数约为 0.97–0.99 秒，其中共享 snapshot
  观察约为 0.81–0.82 秒；默认只返回 2 个 active ideas，却仍读取并
  解析全部 32 个标题。
- `create-idea` 的中位数约为 1.61 秒，实际写入 scaffold 仅约
  10 毫秒；snapshot 观察和 creation readiness 占绝大多数时间。
- aligned primary 上的 bare / selected `whats-next` 中位数分别约为
  2.97 秒和 3.21 秒；fresh fetch 约为 1.29–1.33 秒，其余本地工作仍有
  约 1.68–1.87 秒可优化。
- `check` 的 HEAD、staged、worktree 和 remote 中位数分别约为
  1.50、1.39、1.68 和 3.95 秒。前三者主要受完整 tree
  `checkout-index` 物化影响；remote 还会先完整物化 HEAD 只为读取
  config，再物化 fetched primary。

Trace 也没有覆盖全部用户等待时间：当前 command 根 span 在 renderer
之前结束，不包含 Node 启动、Commander 解析、非交互输出渲染和 trace
写盘；`validBranchName` 直接启动的 `git check-ref-format` 也没有进入
`git.command` span。缺失归因会让优化收益和回归来源难以可靠判断。

## 期望结果

- 每个 Silvermoon 启动的外部进程都能在 trace 中归因；非交互命令从
  已解析参数到输出完成的工作有完整 span，启动、渲染和 trace flush
  的边界明确且不把 TUI 等待时间混入自动化基线。
- 共享 observation context 只解析一次 repository root、config、
  HEAD、branch、upstream 和 snapshot identity，并把可信结果传给
  后续阶段，不为同一事实重复启动 Git。
- `list-ideas` 在不需要标题参与筛选时，先利用 state、ULID creation
  time、sort 和 limit 缩小候选，再只读取返回或仍可能匹配的标题；
  summary、排序、literal query 和完整 layout validation 语义不变。
- `create-idea` 和 `whats-next` 将 worktree、HEAD、branch 与 upstream
  readiness 合并到不超过两个本地 Git 调用；`whats-next` 的 fresh
  primary 语义继续使用恰好一个 network fetch，不用 cache 或陈旧 ref
  伪装成功。
- `check` 不再为了验证 immutable snapshot 而完整 checkout repository
  tree。remote bootstrap 直接从 HEAD snapshot 读取 config，所有 target
  复用一次解析出的 commit/tree，并通过批量 Git object 读取或有界
  materialization 验证所需内容。
- 优化前后对同一输入产生相同的四投影、diagnostics、idea state、
  revisions、退出码和副作用边界；错误继续 fail closed 并保留具体原因。
- 性能验收以可确定的 subprocess、metadata read 和 materialization
  次数为主，以同机器、同 checkout、warm-up 后 5 次 trace 中位数为辅。
  相对本调研基线，默认 `list-ideas` 至少降低 15%，`create-idea` 及
  `whats-next` 的非网络部分至少降低 20%，本地 `check` 至少降低 30%，
  remote `check` 的非网络部分至少降低 35%。

## 范围

### 范围内

- 补齐 trace 对 CLI 输出阶段、全部外部子进程和关键计数的安全观测。
- 复用 repository discovery、configuration、snapshot 与 readiness
  事实，合并可安全合并的 Git 调用。
- 优化 inventory title metadata、phase guidance lookup 和 active idea
  metadata 的候选读取。
- 优化 HEAD、commit、staged、worktree 与 remote `check` 的 immutable
  snapshot 读取和验证方式。
- 增加命令计数、结果等价性、snapshot target、并发变化、SHA-1 /
  SHA-256、Windows 与失败清理测试。
- 更新维护文档中的可复现 benchmark 方法，并保存不含敏感数据的
  before / after 摘要。

### 范围外

- 不改变 `whats-next` 默认是否观察 fresh primary；不在本 idea 增加
  TTL cache、隐式离线模式、常驻 daemon 或跨命令可变全局 cache。
- 不降低 symlink、canonical YAML、完整 idea layout、guidance、
  package adoption、world revision 或 snapshot 隔离检查强度。
- 不把网络延迟写成跨机器 SLA，也不把远端波动当作本地代码优化收益。
- 不优化 `pnpm check` 的测试调度；该工作由 `pnpm-check-regression`
  idea 独立负责。
- 不优化 human TUI 的交互帧率或改变 audience / JSON 输出契约。
- 不发布新的 npm package；deployment 只验证并发布仓库候选。

## 约束

- 不移动或创建调用者的 branch、named ref、index、worktree 或 stash；
  临时资源在成功和失败路径都必须清理。
- 保留 Windows、macOS、Linux 以及 SHA-1 / SHA-256 repository 支持。
- 直接 Git tree reader 或有界 materialization 必须证明与现有 filesystem
  validation 等价，包括 regular file、directory、symlink、UTF-8、
  unexpected entry 和 concurrent worktree 变化。
- Trace 继续遵守 allowlist，不记录 Git 参数、stdout/stderr、文件内容、
  guidance、环境变量、credential、token 或无界错误文本。
- `--trace` 关闭时不得改变 domain stream、命令结果或副作用；trace
  写入失败仍必须显式失败，不能返回 success-shaped fallback。
- 每项优化先以 targeted tests 证明确定性指标，再在相同环境重跑
  warm-up 和 5 次样本，最后运行 `pnpm check`。
