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

- [ ] **D-S01:** 发布并锁定验收候选
- [ ] **D-S02:** 在干净 clone 重放 trace benchmark

### Deployment acceptance criteria

- [ ] **D-AC01:** Primary 候选有效且可追溯
- [ ] **D-AC02:** 干净环境复现确定性优化
- [ ] **D-AC03:** 真实命令行为保持兼容

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
