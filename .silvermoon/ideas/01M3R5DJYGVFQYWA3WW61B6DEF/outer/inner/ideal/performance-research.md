# CLI 子命令性能调研

调研日期：2026-09-30

## 方法

- 在一次性干净 clone 中测量，fixture commit 为
  `10b6f3ff59b6ab8056bef3b64d3018d73689d868`，CLI `src` tree 为
  `8954b0a82b0e6421415075f646011ea06e7e91e6`。
- Fixture 包含 32 个 ideas，其中 2 个为 active；每次创建 benchmark
  只删除该次 `create-idea` 报告返回的精确路径，并在下一次采样前证明
  clone 仍然 clean。
- 环境为 Windows NT 10.0.26220 x64、Intel Core i9-10900X、
  20 logical CPUs、Node v24.11.1、Git 2.55.0.windows.3、
  pnpm 11.22.0。
- 每条最终路径先运行一次 warm-up，再运行 5 次独立
  `--trace <name>.trace.jsonl --json`。表中使用中位数，并保留最小值和
  最大值。`whats-next` 的 aligned 样本在 fresh fetch 后确认 local HEAD
  与 primary 一致；因 primary 并发移动产生的 blocked 样本不混入基线。
- 共采集 90 份诊断 trace；最终基线使用同一 fixture commit 上的
  45 份样本：两个 `list-ideas` 路径、两个 aligned `whats-next` 路径、
  `create-idea`、四个代表性 `check` target，各 5 次。
- 默认 `check` 与 `check --commit <revision>` 在实现中走同一
  commit snapshot 分支，因此以默认 HEAD 代表；`--staged`、
  `--worktree` 和 `--remote` 分别采样。

当前 trace 的根 span 从 command domain work 开始，在 renderer 之前结束；
它不包含 Node module startup、Commander parse、Markdown / JSON render、
TUI interaction 或 trace serialization / write。以下数字因此是已测 command
work，不是用户从 process start 到输出结束的完整 wall time。

## 最终基线

| 路径 | 中位数 | 最小–最大 | 主要阶段中位数 |
| --- | ---: | ---: | --- |
| `list-ideas` 默认 active | 988.021 ms | 965.509–1020.068 ms | `snapshot.observe` 821.961 ms；metadata 161.977 ms |
| `list-ideas --all` | 973.335 ms | 963.329–1177.401 ms | `snapshot.observe` 813.180 ms；metadata 158.333 ms |
| bare aligned `whats-next` | 2969.597 ms | 2939.995–3089.138 ms | readiness 2078.181 ms；snapshot 846.875 ms；metadata 33.840 ms |
| selected aligned `whats-next` | 3205.019 ms | 2942.943–3514.459 ms | readiness 2121.574 ms；snapshot 883.604 ms；guidance 103.427 ms |
| `create-idea` | 1609.058 ms | 1548.791–1677.683 ms | snapshot 839.366 ms；readiness 656.908 ms；guidance 101.292 ms；scaffold 10.253 ms |
| `check` HEAD / commit | 1496.690 ms | 1445.798–1615.340 ms | materialize 1188.510 ms；top-level `rev-parse` 301.476 ms |
| `check --staged` | 1386.240 ms | 1339.531–1445.520 ms | materialize 1183.469 ms；`write-tree` 100.266 ms |
| `check --worktree` | 1676.224 ms | 1642.580–2203.360 ms | materialize 1192.906 ms；worktree tree 构造 387.780 ms |
| `check --remote` | 3945.913 ms | 3638.890–4072.435 ms | materialize x2 1918.205 ms；fetch action 1457.434 ms；top-level `rev-parse` 399.623 ms |

Remote check 的两个 materialization 分开计算时，HEAD bootstrap 中位数为
684.136 ms，fetched primary validation 中位数为 1194.043 ms。前者只是
为了从 HEAD 读取 primary configuration，却支付了一次完整 tree checkout。

## 共同瓶颈

### Worktree observation 仍受短命 Git 进程主导

`list-ideas`、`create-idea` 和 `whats-next` 的共享 snapshot 约为
0.81–0.88 秒。一次普通 observation 包含：

1. `rev-parse --show-toplevel`；
2. scoped `read-tree`；
3. scoped `add --all`；
4. `write-tree`；
5. batch `cat-file`。

这已经比历史逐 world Git 调用显著改善，但 Windows 上每个短命 Git 进程
通常仍花费约 100 ms。`config.load` 自身另有约 105–130 ms exclusive time：
`validBranchName` 直接 `spawnSync("git", ["check-ref-format", ...])`，
该进程没有通过 `src/git.js`，所以 trace 中没有 `git.command` span。

建议先建立 command-scoped observation context：

- 一次解析 repository root 和 config，并把已验证结果传给 snapshot、
  readiness、guidance 和 check；
- 将 branch validation 改为与 Git 等价的纯结构校验，或统一进入可批量、
  可 trace 的 Git runner；
- 保留当前四进程 worktree tree 构造作为安全基线，再用 fixture 原型证明
  in-process tree builder 或更少进程方案与 Git index 语义完全等价后替换，
  不以未证明的 shortcut 换取数字。

### Trace 边界漏掉真实等待与一个 Git 进程

根 command span 不覆盖 render，`withTraceFile` 在 report 完成后先结束 trace，
CLI 才调用 renderer。Node startup 和 Commander parse 也发生在 trace context
建立前。结果是 Markdown / JSON 变慢、module import 回归或
`git check-ref-format` 成本都不会出现在 command breakdown 中。

建议：

- 所有 subprocess 统一由一个 trace-aware runner 启动；
- 对非交互 JSON / Markdown render 增加 span，并让 command envelope 到
  输出准备完成为止；
- 单独记录 bootstrap 到 dispatch 的安全 monotonic duration，不把 human TUI
  停留时间计入自动化性能；
- trace serialization 和 exclusive write 保持在被测 command work 之后，
  但以明确的 flush 结果报告失败。

## 各子命令瓶颈与建议

### `list-ideas`

默认 active 查询与 `--all` 都花费约 160 ms 读取 metadata。实现先对全部
32 个 ideas 执行 `readIdeaInventoryItem`，之后才在
`queryIdeaInventory` 中按 state、time、query、sort 和 limit 过滤。因此默认
仅返回 2 个 active ideas 时仍解析 32 份 `Idea.md`。

建议把筛选分成两阶段：

1. 先用 layout 已有的 state、id、alias 和由 ULID 解出的 creation time
   完成 state / bounds / sort；没有 title query 时还可先应用 limit。
2. 只为仍可能由 title 匹配或最终需要返回的 ideas 读取标题，再完成 literal
   query 和 projection。

完整 layout validation 必须保留，summary counts 仍应基于 limit 前的匹配结果。
默认 fixture 的确定性目标是 title reads 从 32 降为 2。

### `create-idea`

总计 1609.058 ms 中，实际 scaffold action 仅 10.253 ms。Creation readiness
为 656.908 ms，当前依次运行：

- `status` 一次；
- `rev-parse` 一次；
- `symbolic-ref` 一次；
- `git config` 三次。

随后即使 preparing guidance 不存在，也会为 `ls-tree` 再付约 101 ms。

建议使用一次 `git status --porcelain=v2 --branch -z` 同时取得 changes、
HEAD、branch 和 upstream 名称，再用一次 NUL-delimited config 查询解析
branch remote、merge ref 与 remote URL。固定 guidance entry 可与已有
world tree batch lookup 合并。Clean repository 的 readiness 本地 Git
预算应从 6 个进程降到不超过 2 个；scaffold transaction 本身无需优化。

### `whats-next`

Aligned bare / selected 总中位数为 2969.597 / 3205.019 ms。Fresh network
fetch 分别约为 1289.770 / 1333.396 ms，是最大单项，但它是当前
fresh-primary contract 的必要成本。扣除 fetch 后，仍有约 1679.827 /
1871.623 ms 本地工作。

建议：

- 复用 `create-idea` 的 readiness 合并，删除 `status`、`rev-parse`、
  `symbolic-ref` 和三次 config 的重复进程；
- 继续只执行一个 network fetch，并使用 fetch 返回的精确 immutable commit；
  不通过 remote-tracking ref、TTL 或 cache 改变 freshness；
- 将 selected guidance tree lookup 合并到 primary snapshot batch；
- bare navigation 已只读取 2 个 active titles，33.840 ms 不是优先瓶颈。

网络 duration 必须单独报告；性能验收比较总耗时与
`total - network fetch` 两个数，只有后者作为本地代码优化目标。

### `check`

`check` 的共同瓶颈是把 immutable tree 完整 checkout 到临时目录，再由
filesystem validator 读取：

- HEAD / staged / worktree 各有约 1.18–1.19 秒 materialization；
- HEAD 路径在 materialization 外还运行 3 次 `rev-parse`，共约 301 ms；
- remote 先 materialize HEAD 读取 config，再 fetch，再 materialize primary，
  两次合计约 1.92 秒；
- `withTemporaryTree` 的 `checkout-index` 单次约 360–381 ms，此外还有
  `read-tree`、临时目录 IO 与 snapshot 内重复 repository discovery。

建议分两步：

1. 短期合并 root、commit 和 tree resolution，向 adoption 明确传入已验证
   repository root；remote 直接用 HEAD tree 中的 config blob bootstrap，
   不完整 checkout HEAD。
2. 建立统一 snapshot content adapter，以 worktree filesystem 或 immutable
   Git tree 为后端。Git tree 后端批量读取 config、manifest、lockfile、
   registered skill、ideas 和 guidance，并显式保留 regular path、symlink、
   unexpected entry、UTF-8 和 object-format validation。这样所有 check
   target 都无需 full-tree `checkout-index`。

优化必须用同一 tree 的 before / after reports 做深度等价比较，覆盖
invalid layout、symlink、SHA-256、staged-only、untracked、remote fetch
failure 和 cleanup failure，不能仅以 happy-path 时间通过。

## 建议实施顺序

| 优先级 | 工作 | 原因 |
| --- | --- | --- |
| P0 | 补齐 subprocess、render 与 bootstrap trace | 后续优化必须先能完整归因，且当前已有隐藏 Git 进程 |
| P1 | 合并 readiness Git 查询 | 风险较低，可同时改善 `create-idea` 与 `whats-next` 的约 0.4–0.5 秒本地成本 |
| P1 | 去除 `check` full-tree materialization | `check` 最大的确定性本地瓶颈，remote 还重复两次 |
| P2 | 两阶段 inventory metadata | 默认 active 查询可把 title reads 从 32 降为 2，语义边界清晰 |
| P2 | Batch guidance 与共享 repository facts | 每个适用路径可减少约一个 100 ms Git 进程 |
| P3 | 原型化更少进程的 worktree tree builder | 共享 snapshot 仍是主要本地成本，但需最严格的 Git 等价证明 |

每个阶段都应先增加命令计数或 read-count 测试，再改变实现；duration
只在同机、同 checkout、相同 warm-up 与样本数下作为辅助证据。
