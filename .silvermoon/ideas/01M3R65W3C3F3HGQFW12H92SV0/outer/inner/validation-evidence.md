# 验证分层证据

本文件服务于 Implementation 的 I-S01、I-S06 和 I-AC01/I-AC02，不是独立契约。

## 实施前基线

2026-09-30，本机 Windows、Node.js v24.11.1、pnpm 11.22.0，同一独立
worktree `silvermoon-test-validation-tiers`；源码 commit
`1435c77570080f0d497d22e0934eee90a2ad6e95`。依赖准备完成后，两个入口各预热一次，
随后顺序运行五次；不提高并发、不同时运行另一套测量。所有退出码均为 0。
本机非独占，无法排除其他会话的系统资源竞争。

墙钟由外层 Node `performance.now()` 测量（包含 pnpm 启动）；门禁耗时来自
既有 `CHECK_DURATION`。原始输出保存在会话 artifacts，以下保留全部数值，
不是仅保留中位数。

| 入口/门禁 | 预热 ms | 五次样本 ms | 中位数 ms |
| --- | --- | --- | --- |
| `check:quick` 墙钟 | 38,543 | 28,144; 19,587; 20,631; 20,816; 18,807 | 20,631 |
| `check` 墙钟 | 179,853 | 192,629; 120,542; 130,765; 139,614; 121,346 | 130,765 |
| `check` 内 lint | 3,076 | 5,578; 4,900; 3,567; 3,782; 3,286 | 3,782 |
| `check` 内 quick | 42,267 | 57,616; 39,129; 37,422; 39,110; 36,047 | 39,110 |
| `check` 内 integration | 114,714 | 156,815; 95,700; 106,097; 108,556; 95,777 | 106,097 |
| `check` 内 pack | 11,122 | 14,659; 12,398; 9,938; 11,410; 10,735 | 11,410 |
| `check` 内 E2E | 178,783 | 190,592; 119,303; 129,712; 138,498; 120,284 | 129,712 |
| `check` 内 skills | 15,608 | 26,339; 17,070; 14,213; 16,024; 14,628 | 16,024 |

`check:quick` 为 91 unit + 25 contract，共 116 项、25 个测试文件；
`check` 另外执行 120 integration（Windows 原有 2 项符号链接 skip）和
1 installed-package E2E，共 237 项、45 个测试文件。没有扩大 skip 或修改断言。

### 场景与 I/O/子进程归属

| 现有场景 | 对应入口 | I/O 与子进程 |
| --- | --- | --- |
| 日常 | `check:quick` | Node 语法检查、npm unit/contract 两套 runner、25 个测试 worker；adoption/CLI/dialogue 的真实 Git，trace 临时文件及 Windows 原生终端；无 package install |
| 提交前交付 | `check` | 六个并行门禁及其 package-manager shell/Node worker；真实 Git 仓库、临时文件、pack、npm install/exec、npx skills |
| 普通 CI | unit 矩阵、contract、integration | 本地对应成本见 full 内 quick/integration/skills；托管三平台双 Node 及排队时间不是本机墙钟 |
| 发布前 | `check` 及发布 workflow | 同上；workflow 另外做 ancestry、不可变 README/tarball、实际产物身份和安装；不在基线中触发发布 |
| 发布后 | `verify-npm-release.mjs` | 真实 registry、provenance、README/CDN；依赖具体已发布版本，不作为本地性能基线、不执行发布 |

子进程按职责及 runner 文件数盘点，不声称测得 OS 级总进程数或网络请求总数。
full 中 E2E 日志明确包含 pack、init、两次 install 和多次 exec；
skills 的 `npx skills add . --list` 可能访问外部工具缓存/网络。integration
的 Git fetch 使用隔离本地仓库；发布 helper 的网络响应使用 fixture。
这些工作不能进入 sanity；外部工具发现不能进入 commit 默认集合。

### 预先目标与并发限制

sanity 五次中位数 <= 10,315.5 ms；commit <= 65,382.5 ms，分别比对应原入口
改善至少 50%。该目标在任何验证行为变更前随 Implementation 契约发布。
确定性 guard、覆盖守恒和失败传播是独立必要条件，不能由快的样本替代。

测量后合并 primary `9fbce63cf348d079d4728afcaefba929da040b39`：
并发提交调整 README/移除兼容 avatar，更新对应 package/asset/E2E 断言，
另有其他 idea 记录和 integration 尾部空行；未改变测试数量、依赖或 runner。
后续比较明确包含该基线差异，不将这些变更或网络/cache 波动计作分层策略收益，
不为追求相同旧 revision 回退或改写并发历史。

## 实施后证据

### 目标复测

在契约发布 commit `547f7dff32dde01f59e9dc4898184dfe5e300e6f` 之后才修改
scripts/tests/workflows/docs。相同机器、worktree、Node.js/pnpm 和外层墙钟
方法，依次执行每个入口的一次预热及五次样本，所有退出码均为 0。

| 候选 | 入口 | 预热 ms | 五次样本 ms | 中位数 ms |
| --- | --- | --- | --- | --- |
| 初次实现 | sanity | 3,149 | 3,189; 3,199; 3,137; 3,217; 3,170 | 3,189 |
| 初次实现 | commit | 9,939 | 9,946; 10,096; 13,291; 12,455; 12,119 | 12,119 |
| 补齐直接构造 socket/ChildProcess、DNS resolver guard 后 | sanity | 3,139 | 3,148; 3,117; 3,280; 3,861; 3,555 | 3,280 |
| 补齐 guard 后 | commit | 12,106 | 10,849; 10,769; 10,103; 9,534; 9,688 | 10,103 |
| POSIX npm 修复后的最终候选 | sanity | 3,677 | 3,295; 3,394; 3,359; 3,360; 3,443 | 3,360 |
| POSIX npm 修复后的最终候选 | commit | 10,901 | 10,362; 9,800; 9,211; 9,882; 9,380 | 9,800 |

最终 sanity 比原 quick 中位数降低 **83.71%**，commit 比原 full 降低
**92.51%**，分别小于预先固定的 10,315.5/65,382.5 ms。全部样本（包括
补齐 guard 前后的慢样本）均保留。full 的缓存/网络收益不计入策略证明；
这里衡量的是对应场景集合变小后的反馈，不声称完整发布级检查同比加速。

最终 sanity 每次运行 89 项、零 skip（81 纯 unit + 8 schema/API contract）；
commit 每次运行 89 + 25 + 10 项、零 skip，其中 8 项 schema/API 与完整
contract 重叠，复用同一测试文件而非复制断言。每次完整输出均有
`COMMIT_SCOPE`，没有 package/E2E 或外部 discovery 门禁。POSIX 修复前
sanity 为 88 项，新增的平台 dispatch 纯测试在最后一组样本中计入。

### 覆盖迁移与守恒

| 原文件 | 原数量 | 纯集合保留 | 移出但仍执行 |
| --- | --- | --- | --- |
| unit/adoption | 11 | 2 | runtime/adoption 9 |
| unit/cli-v1 | 9 | 8 | runtime/cli-v1 1 |
| unit/trace | 3 | 0 | runtime/trace 3 |
| unit/tui | 9 | 5 | runtime/tui 4 |
| contract/dialogue-output | 3 | 2 | integration/dialogue-output 1 |

迁移的 35 个原始测试 body 对照 HEAD 保持一致；原 timeout、skip 与清理保留。
定向迁移组合 35/35 通过。unit 的 17 个 runtime 测试仍通过 `test:unit` 进入
原有 Ubuntu/Windows/macOS × Node 22/24 矩阵，没有借迁移减少平台保障。

完整套件现为 98 unit/runtime + 25 contract + 124 integration + 1 E2E =
**248 项**；相对原 237 项净增 11 项：runner 场景 1、风险选择 4、guard 1、
测试归属 contract 1、真实 guard/暂存/风险 integration 3、npm 平台 dispatch 1。
Windows 仅保留
原有 2 项符号链接 skip。core 与 E2E 的归属回归枚举所有测试文件，未知目录失败。

### 确定性验证

- 第一组定向 runner/risk/guard/workflow/暂存回归 20/20 通过，随后真实
  guard preload 和补齐的边界定向组合 4/4 通过。
- sanity 在测试 worker 中替换 child_process、socket、DNS、HTTP(S)、
  HTTP2、TLS、datagram 和 fetch 的真实 I/O 入口；Node runner 创建 worker
  不受影响。真实子进程测试证明 preload 进入 worker，误用 Git/fetch 会被拒绝。
  原生终端测试只在 runtime 运行，sanity 不做包安装。
- 风险单元测试覆盖包代码/资源/文档、所有常见锁文件、技能、测试、脚本、
  workflow、未知/非法路径、缺失/无效/错误/空 baseline、显式 full；
  真实 Git fixture 验证 metadata-only、删除/重命名及不可用历史。
- 暂存 fixture 使用真实 Git 和真实 `silvermoon check --staged`：
  index 保留 staged candidate，worktree 探针读取另一个 candidate；
  index/worktree 全程不被入口改写。将无效 status 暂存后在 worktree 修好，
  commit 仍因 staged 门禁退出 1。其他场景门禁用 fixture package manager
  替身，避免把该边界测试误称为全套工作区测试。
- runner 拒绝错误参数、空集合，测试 startup/nonzero 失败并等待全部门禁、
  汇总失败与单调耗时。release/default 精确包含原六门禁，未加入发布动作。
- workflow contract 验证核心 job 无条件、三平台双 Node 矩阵、完整 diff、
  显式 full、package/E2E 条件，及发布权限/环境/tag/commit/实际 tarball
  和发布后验证。没有执行 npm 发布或真实 post-release 验证。

### 发布级检查

首次 `pnpm check` 退出 0，完整 247 项（245 pass、2 原有 skip）、六门禁通过：

| 门禁 | 耗时 ms |
| --- | --- |
| lint:markdown | 3,711 |
| check:quick | 28,260 |
| test:integration | 110,293 |
| pack:check | 13,103 |
| test:e2e | 140,504 |
| check:skills | 22,246 |
| CHECK_TOTAL | 140,564 |

`PACK_OK` 为 silvermoon@0.2.2、49 个文件；installed-package 输出
`PACK_SMOKE_OK`，本地技能输出 `SKILLS_CHECK_OK files=2`，外部 discovery 成功。
Markdown lint 零问题，Markdown 链接由完整 contract 检查。
补齐 guard 后的全量结果、快照校验及非强制发布的精确 commit
记录在 idea-root ledger，避免证据自引用改变其自身 revision。

### 托管 CI 暴露的问题及最终验证

实现 commit `9e41052f05a9dbe8fb1ce16f61545ec9a74dffe0` 的
[CI 36668763265](https://github.com/shazhou-ww/silvermoon/actions/runs/36668763265)
中六个矩阵 unit/runtime、contract、integration 和 risk 成功；新增的 package
job 真实执行 E2E 后失败。原 E2E 在 pnpm 环境下把 POSIX Node 安装错误地当成
Windows，查找 `bin/node_modules/npm/bin/npm-cli.js`。没有跳过测试、改用 npm
启动 workflow 来掩盖，或重跑旧候选声称通过。

修复 commit `50c3d698b566b4bc16f08f575370531b6e53a77e` 将既有 build/pack
的跨平台调用方式抽为 `scripts/npm-command.mjs` 并复用于 E2E。POSIX 使用
PATH npm，Windows 保留 shell-free Node + npm-cli，错误仍明确失败。
新增纯测试同时证明 Linux/macOS、Windows fallback/configured path 及参数
含空格的原样传递。窄测试 6/6 通过。

该 commit 的
[CI 36669180127](https://github.com/shazhou-ww/silvermoon/actions/runs/36669180127)
**10/10 jobs 成功**：六个 Ubuntu/Windows/macOS × Node 22/24 unit/runtime、
contract、integration、risk、package contents/installed CLI。package job
实际执行而非跳过。最终本地 `pnpm check` 同样退出 0：248 项、246 pass、
2 原有 skip；CHECK_TOTAL 133,239 ms，lint/quick/integration/pack/E2E/skills
依次为 3,300/28,684/112,592/10,017/133,181/15,990 ms。
无新增依赖，无 npm 发布、tag 创建或真实发布后动作。
