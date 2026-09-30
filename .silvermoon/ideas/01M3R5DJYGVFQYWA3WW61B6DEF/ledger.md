# Ledger

## Implementation

### Implementation steps

- [x] **I-S01:** 补齐可归因的测量边界
- [x] **I-S02:** 合并 repository observation 与 readiness
- [x] **I-S03:** 缩小 inventory metadata 读取
- [x] **I-S04:** 直接验证 immutable check snapshot
- [x] **I-S05:** 证明结果等价与性能改善

### Implementation acceptance criteria

- [x] **I-AC01:** Trace 覆盖真实命令工作且保持安全
- [x] **I-AC02:** Inventory 只读取必要标题
- [x] **I-AC03:** Creation 与 navigation 合并本地 Git readiness
- [x] **I-AC04:** Check 不再完整物化 repository
- [x] **I-AC05:** 相对性能目标通过
- [x] **I-AC06:** 完整兼容性验证通过

## Deployment

### Deployment steps

- [x] **D-S01:** 发布并锁定验收候选
- [x] **D-S02:** 在干净 clone 重放 trace benchmark

### Deployment acceptance criteria

- [x] **D-AC01:** Primary 候选有效且可追溯
- [x] **D-AC02:** 干净环境复现确定性优化
- [x] **D-AC03:** 真实命令行为保持兼容

## Preparation evidence

- 2026-09-30：在一次性干净 clone 上使用 Node v24.11.1、
  Git 2.55.0.windows.3 和 pnpm 11.22.0 采集 90 份诊断 trace；
  最终基线只使用同一 fixture commit 上的 45 份 warm 后样本。
- 基线 fixture 为 32 个 ideas、2 个 active ideas，CLI `src` tree 为
  `8954b0a82b0e6421415075f646011ea06e7e91e6`。原始 trace 保存在
  session artifact 中且未提交；可复现方法、全部最终中位数和建议记录在
  `outer/inner/ideal/performance-research.md`。

## Implementation evidence

- 2026-09-30（I-S01、I-AC01）：统一 production subprocess runner，先让
  隐藏的 `git check-ref-format` 进入 `git.command`；command 根 span 现在
  覆盖非交互 render，记录 executable bootstrap duration，最终以独立
  `trace.flush` 根 span 明确 durable write 边界。targeted trace / CLI /
  TUI / config tests 共 34 项，33 项通过，1 项因 Windows 标准 CI 无
  symlink 权限按既有条件跳过。
- 同一 worktree 的默认 `list-ideas --audience agent` 诊断 trace 中，
  改动前只有 5 个 Git span 且没有 render / flush span；改动后 6 个
  Git span 明确包含 `check-ref-format`，同时存在 `output.render`、
  `trace.flush` 和 `bootstrapDurationMs`。最终以 valid / invalid /
  reserved-name corpus 对照真实 Git，补齐 `HEAD` 特例后证明纯结构校验
  保持 `git check-ref-format --branch` 语义，并安全删除该进程；最终
  inventory 每样本为 5 个可追踪 Git process。原始 trace 只保存在
  session artifact，未提交到 repository。
- 2026-09-30（I-S02、I-AC03）：clean creation 与 aligned navigation 的
  local readiness 都只运行一次 porcelain v2 `status` 和一次 NUL-delimited
  `config`；navigation 仍恰好执行一次 network `fetch` 并使用其 porcelain
  commit。dirty、conflict、upstream mismatch、behind、ahead、diverged
  targeted tests 保持 diagnostics 与安全 remediation。
- phase guidance 改为一次 recursive tree metadata inspection 与一次有界
  batch blob read；34 项 observation / guidance targeted tests 全部通过，
  覆盖 SHA-1、SHA-256、symlink、raw size、UTF-8、BOM、NUL、unexpected
  entry、snapshot isolation 和 trace content redaction。
- 2026-09-30（I-S03、I-AC02）：两阶段 inventory query 先以
  state / ULID creation time / sort / limit / ID / alias 缩小候选，再读取
  query 判定或最终 projection 所需标题。32 ideas、2 active fixture 的
  `candidateCount=2`、`titleReadCount=2`；22 项 query / inventory / CLI
  targeted tests 全部通过。当前 34-idea worktree 的默认 trace 为
  `candidateCount=4`、`titleReadCount=4`，原始 trace 仅保存在 session
  artifact。
- 2026-09-30（I-S04、I-AC04）：HEAD / commit / staged / worktree /
  remote validation 改为直接 Git tree snapshot adapter，一次读取 tree
  metadata 并 batch 读取 config、status、guidance、manifest 与 canonical
  skill 所需 blobs；layout 与 guidance 复用相同 object / mode 事实，
  check path 不再调用 `checkout-index` 或任何 `snapshot.materialize*`。
  remote bootstrap 直接从 HEAD tree 读取 config，仅为 fetched primary
  打开一次 `snapshot.open`。
- check / Git targeted tests 覆盖全部 target、SHA-1 / SHA-256、Git symlink
  mode、相同 tree 不同 parent topology、staged / worktree isolation、
  snapshot 后并发文件变化和 fetch failure。当前 worktree 单样本 trace
  从调研基线 HEAD 1496.690 ms / worktree 1676.224 ms 降至
  528.695 ms / 854.195 ms，且 materialization count 为 0；原始 trace
  仅保存在 session artifact。
- 2026-09-30（I-S05、I-AC05）：相同 fixture commit/tree、D: volume、
  一次 warm-up 后的最终 45 份 trace 全部记录于
  `outer/inner/performance-results.md`，没有删除 measured sample。5 次
  中位数相对基线为：默认 inventory 754.952 ms（降低 23.6%）；
  bare / selected navigation 非网络 1182.169 / 1106.416 ms（降低
  29.6% / 40.9%）；creation 1128.379 ms（降低 29.9%）；HEAD /
  staged / worktree check 471.040 / 507.697 / 770.599 ms（降低
  68.5% / 63.4% / 54.0%）；remote check 非网络 812.148 ms（降低
  67.4%）。所有验收阈值通过。
- 最终每份默认 inventory trace 均为 `candidateCount=2`、
  `titleReadCount=2`、5 个 Git process；HEAD / staged / worktree /
  remote check 分别为 4 / 4 / 6 / 8 个 Git process，45 份 after trace
  的 materialization count 全部为 0。一次 C: storage 自检组和所有 D:
  完整重跑均保留在 session artifact，不参与或选择替换最终样本。
- 2026-09-30（I-AC06）：focused tests 发现并删除 guidance metadata 的
  重复 `ls-tree`，随后 guidance 7 项全部通过。`git diff --check` 和
  release-grade `pnpm check` 全部通过；后者覆盖 Markdown、unit /
  contract、126 项 integration（124 通过、2 项按既有环境条件跳过）、
  精确 npm pack allowlist、installed-package e2e 与 canonical skills。

## Deployment evidence

- 2026-09-30（D-S01、D-AC01）：锁定 configured primary commit
  `ecd36f566009792dd5bd439b5b8d5b436f17d8bb`。该 commit 的
  implementation revision 为
  `a01c1c734ffac5297f7a44aec3ca95aa149889cf`，Deployment revision 为
  `8270ba3fc9515114445d9e251773b0df4e48d931`，两者均从刷新后的
  `origin/main` 可达。`silvermoon check --remote` fetch 并验证的精确
  commit 同为 `ecd36f5`；release-grade `pnpm check` 全部通过，其中
  integration 130 项为 128 项通过、2 项按既有环境条件跳过，
  installed-package e2e 通过。未执行 npm publish 或修改任何外部服务。
- 2026-09-30（D-S02、D-AC02）：从 configured primary 创建一次性
  clean source clone 并 checkout `ecd36f5`，以锁文件恢复依赖；实际
  executable 的 source tree 为
  `c008ece7d7f83edce878fd634428f9805ee97d58`。可比 fixture commit /
  tree 为 `10b6f3ff59b6ab8056bef3b64d3018d73689d868` /
  `54c7947a412e9c0e9c6d61814690aaae8bb0f16a`，包含 32 个 ideas、
  2 个 active ideas。
- 环境锁定为 Windows 10.0.26220 x64、Intel Core i9-10900X、
  20 logical CPUs、Node v24.11.1、Git 2.55.0.windows.3 与
  pnpm 11.22.0。每条路径先执行一次未计入的 warm-up，再保留 5 份
  独立 trace。前两次 harness hygiene retry 分别在依赖恢复和 inventory
  shape 自检阶段停止，均发生在 warm-up 前、没有 measured sample，且
  operation-owned clone 已删除；最终成功组完整保留，未删除或替换样本。
- 最终全部 5-sample 总耗时如下，单位为 ms：

  | 路径 | 样本 1 | 样本 2 | 样本 3 | 样本 4 | 样本 5 | 中位数 |
  | --- | ---: | ---: | ---: | ---: | ---: | ---: |
  | 默认 `list-ideas` | 663.596 | 705.747 | 636.745 | 700.480 | 677.063 | 677.063 |
  | `list-ideas --all` | 782.056 | 1223.717 | 849.262 | 1085.819 | 797.688 | 849.262 |
  | bare `whats-next` | 1194.635 | 1228.346 | 1282.738 | 1261.764 | 1300.977 | 1261.764 |
  | selected `whats-next` | 1274.353 | 1274.145 | 1267.694 | 1413.014 | 1346.247 | 1274.353 |
  | `create-idea` | 1013.926 | 955.582 | 997.607 | 1012.129 | 1162.228 | 1012.129 |
  | `check` HEAD | 473.424 | 485.941 | 491.384 | 645.108 | 441.994 | 485.941 |
  | `check --commit` | 459.602 | 480.233 | 424.501 | 549.181 | 488.637 | 480.233 |
  | `check --staged` | 538.926 | 521.529 | 436.168 | 430.236 | 417.416 | 436.168 |
  | `check --worktree` | 657.927 | 701.064 | 718.878 | 752.725 | 876.829 | 718.878 |
  | `check --remote` | 1008.154 | 903.858 | 981.982 | 1068.646 | 934.398 | 981.982 |

- Network 与非网络样本逐项计算后再取中位数，没有用总中位数减网络
  中位数代替：

  | 路径 | 指标 | 样本 1 | 样本 2 | 样本 3 | 样本 4 | 样本 5 | 中位数 |
  | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
  | bare `whats-next` | network | 235.262 | 291.193 | 234.040 | 309.292 | 325.146 | 291.193 |
  | bare `whats-next` | 非网络 | 959.373 | 937.153 | 1048.698 | 952.472 | 975.831 | 959.373 |
  | selected `whats-next` | network | 303.333 | 289.840 | 280.339 | 359.122 | 236.353 | 289.840 |
  | selected `whats-next` | 非网络 | 971.020 | 984.305 | 987.355 | 1053.892 | 1109.894 | 987.355 |
  | `check --remote` | network | 225.221 | 230.683 | 261.780 | 330.221 | 237.260 | 237.260 |
  | `check --remote` | 非网络 | 782.933 | 673.175 | 720.202 | 738.425 | 697.138 | 720.202 |

- 相对调研基线，默认 inventory 降低 31.5%，bare / selected navigation
  非网络降低 42.9% / 47.2%，creation 降低 37.1%，HEAD / explicit
  commit / staged / worktree check 降低 67.5% / 67.9% / 68.5% /
  57.1%，remote check 非网络降低 71.1%；全部超过 contract 阈值。
- 每份默认 / all inventory trace 分别固定为 2 / 32 次 title read；
  每样本 Git process budget 固定为 inventory 5、navigation 8、
  creation 8、HEAD / commit / staged check 4、worktree check 6、
  remote check 8。全部 50 个 measured traces 的
  `snapshot.materialize*` count 和非 Git process count 都为 0，
  network 路径都恰好执行一次 fetch。
- 2026-09-30（D-AC03）：同一 clean fixture 中，agent Markdown、
  非 TTY human Markdown、四投影 JSON 与 trace flush / redaction
  调用均通过。对 read-only inventory、navigation 和 remote check
  比较前后 branch、HEAD、index、named refs 与 worktree，结果完全一致。
  `create-idea` 只生成报告所列 ID 下的 5 个 canonical scaffold 文件；
  删除该精确路径后 repository 恢复 clean。clean source clone 还重放
  create transaction failure / cleanup integration tests并通过。
- 最新 validation tiers 的 `check:sanity` 首次发现 branch-equivalence
  corpus 会启动真实 Git，却仍位于 pure unit 集合。仅将该真实 Git 测试
  重新分类到既有 `test/runtime`，无 subprocess 的输入测试仍留在
  `test/unit`；production source 与 world revisions 均未改变。
  修复后 sanity 92 / 92、targeted runtime / unit 2 / 2 通过。
- Index 与 worktree 对齐后，`pnpm check:commit` 的 sanity、contract、
  Markdown、local skill consistency、runtime smoke、staged Silvermoon
  metadata 和 diff gates 全部通过；最终 release-grade `pnpm check`
  也全部通过，其中 integration 130 项为 128 项通过、2 项按既有环境
  条件跳过，installed-package e2e 通过。
- 最终保留 61 份安全 trace（50 measured、10 warm-up、1 compatibility）
  和 `summary.json` 于 session artifact
  `cli-performance-deployment-2026-09-30T04-59-36-642Z/`；source 与
  fixture 均证明 clean，operation-owned 临时 clone 数为 0。
