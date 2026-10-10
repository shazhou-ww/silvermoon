# Integration test 调研

## 结论

当前慢点不是单一用例，也不是默认并发不足，而是三个因素叠加：

1. 少数大文件形成串行关键路径；
2. V2 用例反复初始化工作仓、bare remote 和大量 Git 子进程；
3. 压力规模、完整拓扑矩阵、精确呈现断言与日常边界回归混在同一层。

因此不采用预设的 40% 降幅。第一阶段以同一参考环境下快速层三次运行
中位数不超过 120 秒、任一次不超过 130 秒为预算；完整风险层保留覆盖，
但不进入每次开发与 pull request 的高频路径。

## 基线与方法

- 日期：2026-10-10。
- 环境：Windows、Node.js v24.11.1、`availableParallelism=20`。
- 首次运行：`pnpm test:integration`，完整命令 168.6 秒，其中 Node test
  阶段 161.2 秒。
- 为排除 build 差异，再运行两次
  `node --test "test/integration/*.test.ts"`；三次 test 阶段分别为
  161.2、162.9、156.3 秒，中位数 161.2 秒，极差占中位数 4.1%。
- 三次均为 159 项、154 通过、5 跳过、0 失败。
- 154 个实际执行用例的耗时累计为 1,173.1 秒；该值包含并行重叠，
  不能当作墙钟时间，但可用于识别工作量集中位置。

限制并发不是改进方向：

| test concurrency | test 阶段 |
| ---: | ---: |
| 默认（20） | 中位 161.2 秒 |
| 8 | 215.3 秒 |
| 4 | 380.9 秒 |

Git 和子进程型测试仍能从较高并发获益；直接限制 worker 反而扩大总时长。

## 成本分布

高成本文件隔离运行结果如下：

| 文件 | 隔离耗时 |
| --- | ---: |
| `whatsnext-setup.test.ts` | 120.3 秒 |
| `incremental-append.test.ts` | 86.9 秒 |
| `create-idea-transactions.test.ts` | 55.2 秒 |
| `whatsnext-guidance.test.ts` | 48.6 秒 |
| `whatsnext-readiness.test.ts` | 46.0 秒 |
| `list-ideas.test.ts` | 39.0 秒 |
| `project-runtime.test.ts` | 35.1 秒 |
| `check-v1-snapshots.test.ts` | 34.3 秒 |
| `git.test.ts` | 28.5 秒 |
| `dialogue-output.test.ts` | 7.7 秒 |

整套并发运行中，`whatsnext-setup.test.ts` 内 15 个顺序用例累计
147.0 秒，已达到整套 161.2 秒墙钟的 91%。这说明大文件内的顺序场景
是关键路径；仅增加或减少文件级 worker 都不能解决。

源码静态盘点得到 27 个文件、160 个 test 定义，以及 102 处 `fixture()`
调用、44 处直接 `createRepository()`、307 处显式 `git()` 和 25 处
`spawnSync()`。这些是调用点而非运行时进程总数，循环和 helper 内部 Git
还会进一步放大实际工作量。

## 具体问题

### 1. 常用 V2 fixture 没有模板复用

[repository fixture](../../../../../../test/helpers/repository.ts) 只在默认
V1 配置走缓存模板；`whats-next` 和 `create-idea` helper 默认创建 V2
仓库，因此每个用例都会重新执行 Git init、配置、提交、创建 bare remote
和 push。`whatsnext-setup.test.ts` 单文件有 16 处 fixture 调用，是当前
最清晰的固定开销来源。

优先复用按 schema、object format 和基础 idea 集合区分的不可变模板，
每个用例仍复制为独立工作仓和 remote；特殊拓扑继续走显式建仓路径。

### 2. 压力规模混入日常边界回归

[incremental append integration](../../../../../../test/integration/incremental-append.test.ts)
在普通套件中重复使用 1,001、2,001 和 10,001 条事件，并多次启动真实
CLI。与此同时，[cursor runtime tests](../../../../../../test/runtime/cursor-events.test.ts)
和 [single-file runtime tests](../../../../../../test/runtime/single-file-events.test.ts)
已经用 1,000 条事件验证 cursor、前缀、重试和完整 reduction 语义。

真实 CLI 边界仍需保留，但快速层只需要小规模代表样本；10,001 条事件、
完整历史投影和大流多格式组合属于 extended/stress 层。

### 3. 正交属性被乘到每个真实 snapshot

[check snapshot integration](../../../../../../test/integration/check-v1-snapshots.test.ts)
把 SHA-256、package metadata、repository skill path、输出语言等独立属性
分别乘到 HEAD、commit、staged、worktree、remote 五种 snapshot；语言
用例还对每种 target 同时跑 baseline 和 localized。snapshot 选择本身应保留
完整矩阵，但与 target 无关的语言和忽略规则只需 contract 覆盖加一个真实
snapshot smoke。

类似地，`whats-next` 集成用例同时断言生命周期行为、完整 report shape、
精确自然语言和 Markdown 呈现；后两者已有
[renderer contracts](../../../../../../test/contract/dialogue-output.test.ts)
覆盖，应从高成本 Git 场景移出。

### 4. 存在可直接删除或合并的重复覆盖

- [integration dialogue output](../../../../../../test/integration/dialogue-output.test.ts)
  用一个真实 remote 再次验证四投影 envelope；相同契约已在 unit、
  renderer contract 和各 command integration 中断言，可删除该文件。
- package metadata 与 Silvermoon 生命周期无关，当前分别在 check、
  create-idea、whats-next 中各自建仓验证。公共命令边界仍应覆盖，但可在
  一个共享仓库场景中按顺序调用三个命令，而不是重复准备三套仓库。
- `whats-next` 的精确中文 gate 文本、表格和 Markdown 结构应由 contract
  测试负责；integration 只保留 content language、revision 与 primary
  绑定等跨边界事实。

### 5. CI 重复执行最重文件

[CI workflow](../../../../../../.github/workflows/ci.yml) 在 3 个系统乘
2 个 Node 版本的 6 个 unit matrix job 中执行 `git.test.ts` 和
`incremental-append.test.ts`，随后 Ubuntu integration job 又执行完整套件。
也就是说，最重的 event integration 文件在一次普通 CI 中最多运行 7 次。

跨平台 matrix 应只保留 native timestamp、文件身份和一个小规模真实 CLI
smoke；完整 event stream 与压力规模只在单个 extended job、定时任务和
release/publish 门禁执行。

## 建议分层

| 层 | 责任 | 高频入口 |
| --- | --- | --- |
| Fast integration | 小规模真实 filesystem、Git、CLI 边界；每个产品行为保留一个代表场景 | 本地默认、pull request |
| Extended integration | 多拓扑完整矩阵、SHA-256 组合、事务恢复、大事件流和完整历史 | 定时、release、publish |
| Platform smoke | native timestamp/identity 和小规模 event CLI | OS/Node matrix |
| Live external | 真实 Copilot 或其他外部服务 | 显式 opt-in |

实现时先拆分形成关键路径的大文件，再复用 V2 fixture；随后删除或迁移重复
断言，最后才调整 scripts 和 CI。这样每一步都能用同一三次基线验证收益，
也能在覆盖变化前发现回归。

## 可验证目标

1. 快速层在上述参考环境连续运行三次，中位数不超过 120 秒，且任一次
   不超过 130 秒。120 秒取自当前最慢文件的隔离耗时，不是预设百分比；
   目标降幅约 25.6%。
2. extended、platform smoke 与 live external 的归属清晰，release 和
   publish 仍能执行完整非 live 风险集合。
3. 每个迁移、合并或删除的用例都有旧覆盖、新覆盖和运行层记录；关键事件
   流完整性、事务、Git 拓扑、跨进程 CLI 与发布链路不得只剩 mock。

## 风险与后续验证

- 本地 Windows 数据不能代替 Ubuntu CI 数据；部署阶段应记录三个真实 CI
  样本后再设置 CI job budget。
- 模板复用必须证明工作仓、remote、Git object format 和 test mutation
  相互隔离，不能以共享可变状态换速度。
- 文件拆分会改变 worker 调度；每次结构调整后都应重新跑三次整层，而不是
  用单文件耗时直接推算最终墙钟。
