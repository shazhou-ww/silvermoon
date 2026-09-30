# Ledger

## Implementation

### Implementation steps

- [x] **I-S01:** 建立五次预热基线并定位回归
- [x] **I-S02:** 减少本地集成 fixture 的冗余 remote 初始化
- [x] **I-S03:** 输出各并发门禁与完整检查的耗时
- [x] **I-S04:** 固化性能回归覆盖与复现说明
- [x] **I-S05:** 拆分可独立并行的高成本集成测试组

### Implementation acceptance criteria

- [x] **I-AC01:** 完整检查预热中位耗时至少降低 15%
- [x] **I-AC02:** 所有既有验证覆盖保持完整
- [x] **I-AC03:** Fixture 隔离、失败汇总与耗时报告可验证
- [x] **I-AC04:** 性能测量方法可复现且不依赖机器硬预算
- [x] **I-AC05:** 拆分后的集成测试保持完整且彼此隔离

### Implementation notes

- 基线环境为 Windows、Node.js 24.11.1、pnpm 11.22.0、commit `c5639db`。预热后五次 `pnpm check` 为 185,357、174,495、160,047、176,941、187,818 ms，中位数 176,941 ms；`test:integration` 中位数为 174,771 ms，`test:e2e` 中位数为 117,963 ms。完整检查由六个并发门禁组成，integration 是主要关键路径。
- 基线覆盖为 integration 116 个（114 通过、2 个因 Windows 符号链接权限跳过）、unit 78 个、contract 31 个、installed-package E2E 1 个。优化后为 integration 119 个（117 通过、相同的 2 个权限跳过）、unit 91 个、contract 32 个、installed-package E2E 1 个；没有删减测试或新增跳过。
- 默认 `createRepository()` 预热后五次创建真实隔离仓库的耗时为 1,507、1,495、1,464、1,495、1,621 ms，中位数 1,495 ms。优化后默认 remote fixture 中位数为 327 ms，local-only fixture 中位数为 195 ms。原始测量与方法见同世界辅助文件 `performance-baseline.md`。
- 已验收的历史 `faster-test-suite` 使用 Node.js 24.12.0、pnpm 11.22.0，完整检查中位数为 54,585 ms、integration 中位数为 32,337 ms，integration 有 75 个测试。工具补丁版本和覆盖不同，因此不作为同条件验收对照。
- 最终候选 `ac2bcaaf33c227bc79443553655290ff70d10554`（Windows、Node.js 24.11.1、pnpm 11.22.0）先预热一次，再连续五次通过完整 `pnpm check`。总耗时样本为 145,749、180,889、199,106、128,053、125,910 ms，中位数 145,749 ms；相较基线降低 17.63%，优于至少 15% 的门槛（目标上限 150,400 ms）。各次 integration 门禁为 110,622、169,374、161,765、109,908、104,513 ms；`check:quick` 为 42,417、83,468、41,677、48,268、39,096 ms；`test:e2e` 为 145,639、180,767、199,022、127,982、125,851 ms。波动样本完整保留，未将网络、排队或缓存变化解释为代码收益；各门禁与完整检查的记录见同世界辅助文件。
- 最终候选的预热检查耗时为 144,038 ms（integration 120,046 ms、`check:quick` 45,011 ms、`test:e2e` 143,962 ms）。完整 `pnpm check` 五次样本均退出码为 0；覆盖 lint、快速测试、集成测试、打包检查、installed-package E2E 与技能检查。
- 高成本测试已拆分为隔离文件组：whats-next 4 个文件，create-idea 与 check-v1 各 2 个文件；默认 `pnpm test:integration` 入口保持不变，最终共 19 个 integration 文件。一次 20 文件实验触发 Windows Git 子进程 paging-file 错误，因此将两个低成本 whats-next 组重新合并；19 文件版本完整通过且无资源错误。
- 测量方法、原始前后数据及历史限制见同世界辅助文件 `performance-baseline.md`；贡献者复现步骤见 `docs/maintaining.md`。`pnpm test`、`pnpm test:integration`、`pnpm test:e2e`、`pnpm check` 与 `git diff --check` 均通过。

## Deployment

### Deployment steps

- [x] **D-S01:** 发布并锁定实际采用的 primary 候选
- [x] **D-S02:** 在干净消费者 checkout 验证完整开发检查
- [x] **D-S03:** 核实托管 CI 并发布外部证据

### Deployment acceptance criteria

- [x] **D-AC01:** 已验收实现与操作说明在 primary 可获取
- [x] **D-AC02:** 干净 checkout 可运行完整检查且诊断完整
- [x] **D-AC03:** 固定候选的远端 CI 通过且证据可审阅

### Deployment notes

- 2026-09-30：部署契约先发布于 primary commit
  `9258c5ee882e6d457ef6c01349063b99f1b121a8`，成功报告的 deployment revision 为
  `3327e2e0666db482fbb559498305ca54194c10c7`。该 commit 与验收事实提交
  `1435c77570080f0d497d22e0934eee90a2ad6e95` 相比只修改本 idea 的部署契约和
  ledger，没有修改交付代码、inner tree 或用户决定。`git merge-base --is-ancestor`
  证明部署候选在配置的 `origin/main` 上可达。
- `git rev-parse <candidate>:.silvermoon/ideas/01M3PW06ZTSWFN6CBRMX4JJABV/outer/inner`
  返回 `986e6a54fe4bf853b1431fbadd06a0a3ddebc03f`，与用户已验收实现一致。
  [固定版本贡献者说明](https://github.com/shazhou-ww/silvermoon/blob/9258c5ee882e6d457ef6c01349063b99f1b121a8/docs/maintaining.md)
  包含窄测试、完整检查、单调耗时输出及一次预热后五次采样方法。
- 从配置的 GitHub repository 独立 clone 后固定到上述 commit；环境为 Windows、
  Node.js 24.11.1、pnpm 11.22.0。新 checkout 无依赖时 source CLI 明确报告
  `ERR_MODULE_NOT_FOUND`；随后 `pnpm install --frozen-lockfile` 成功，未改动
  manifest 或 lockfile，`silvermoon check` 验证固定 HEAD 通过。
- 先运行 `node --test test/unit/run-checks.test.mjs test/integration/repository-fixtures.test.mjs`：
  9 项通过、0 失败、0 跳过，证明真实 remote/local fixture 隔离、并发调度、失败
  汇总与单调计时。再运行一次 `pnpm check`，退出码 0，六个门禁均有唯一的
  `CHECK_OK` 与非负 `CHECK_DURATION`，并有唯一 `CHECK_TOTAL 137194ms`。

| 门禁 | 部署 smoke 耗时（ms） | 结果 |
| --- | ---: | --- |
| `lint:markdown` | 10,796 | 通过 |
| `check:quick` | 42,950 | 91 unit、25 contract 全部通过 |
| `test:integration` | 110,305 | 120 项，118 通过、2 项既有权限跳过 |
| `pack:check` | 12,437 | 通过 |
| `test:e2e` | 137,133 | 1 项 installed-package smoke 通过 |
| `check:skills` | 17,125 | 通过 |

- 两项跳过仍为 Windows 普通环境无符号链接权限的 metadata/config 与 user-config
  测试，没有新增 skip。历史实现测量的 contract 数为 32；此次固定 primary 的
  集合为 25，反映部署前已合入的其他任务文档测试调整，本部署未删除任何测试。
  本次 137,194 ms 是独立消费者单次 smoke，不是新的五次基线，也不用于声称新的
  性能提升。已通知独立测试分层 session 避开本次验证窗口后再做性能采样。
- checkout 在安装前、定向测试后与完整检查后 `git status --porcelain` 均为空。
  该操作专有的临时 checkout 已按精确路径删除，并确认不存在；未触碰其他
  worktree、全局 Git 配置或系统资源设置。原始运行日志保留在会话附件中；
  PowerShell 把 pnpm 的 stderr 命令回显包装为 `NativeCommandError`，实际 pnpm
  退出码为 0，所有 runner 的 fail 数均为 0，不能将回显包装误判成测试失败。
- [GitHub CI run 36666158098](https://github.com/shazhou-ww/silvermoon/actions/runs/36666158098)
  的 head SHA 精确等于部署候选 `9258c5ee882e6d457ef6c01349063b99f1b121a8`，
  run conclusion 为 success。Ubuntu、Windows、macOS 的 Node.js 22/24 六个 unit
  job，以及 Repository contracts、Git integration 两个 job 均为 success。
- 本次证据只更新 ledger，不改变已发布 deployment revision。完成记录不代表
  人工部署验收；保持 deploying，待明确批准精确 revision 后才记录
  `deploymentAcceptedRevision`。没有执行 npm 发布。
