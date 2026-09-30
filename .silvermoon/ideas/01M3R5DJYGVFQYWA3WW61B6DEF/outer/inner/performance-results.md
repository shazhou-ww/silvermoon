# CLI 性能实现结果

测量日期：2026-09-30

## 方法与可比性

- Before 与 after 都使用一次性 clean clone、相同 fixture commit
  `10b6f3ff59b6ab8056bef3b64d3018d73689d868`。该 commit 的 root tree 为
  `54c7947a412e9c0e9c6d61814690aaae8bb0f16a`，CLI `src` tree 为
  `8954b0a82b0e6421415075f646011ea06e7e91e6`。
- Fixture 包含 32 个 ideas、2 个 active ideas。通过 Git `insteadOf`
  将 canonical primary URL 映射到同机 bare repository；每个命令先
  warm-up 一次，再保留 5 份独立 `--trace`。
- After fixture 与 source worktree 位于同一 D: volume。每个样本前后都证明
  clone clean；`create-idea` 只删除该次报告返回的精确 idea 路径。
- 环境与基线相同：Windows NT 10.0.26220 x64、Intel Core i9-10900X、
  20 logical CPUs、Node v24.11.1、Git 2.55.0.windows.3 和
  pnpm 11.22.0。
- 总耗时取 `command.*` span；network 耗时为该 command 下所有
  `attributes.network=true` 的 `git.command` span 之和，非网络耗时为两者
  之差。5 个样本分别计算后再取中位数。
- After command span 比基线边界更完整，额外包含非交互 render；
  `trace.flush` 仍是 command 后的独立 root span。这个边界变化只会让
  after 比较更保守。

Harness 最初的可比性自检误将 fixture 放到系统 C: 临时盘，Git process
耗时约为 D: 的两倍。该次完整 45 样本保留在 session artifact，但在阈值
计算前整组判定为不同 storage environment。随后在 D: 原样重跑完整矩阵，
并在最后一个相关生产修复后再次整组重跑；下列最终组没有删除或替换任何
measured sample。

## 验收结果

| 路径与验收指标 | 基线中位数 | After 中位数 | After 最小–最大 | 降低 | 要求 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 默认 `list-ideas` 总耗时 | 988.021 ms | 754.952 ms | 707.467–805.781 ms | 23.6% | >= 15% |
| bare aligned `whats-next` 非网络 | 1679.827 ms | 1182.169 ms | 1009.900–1358.603 ms | 29.6% | >= 20% |
| selected aligned `whats-next` 非网络 | 1871.623 ms | 1106.416 ms | 974.371–1482.727 ms | 40.9% | >= 20% |
| `create-idea` 总耗时 | 1609.058 ms | 1128.379 ms | 1086.712–1213.379 ms | 29.9% | >= 20% |
| `check` HEAD 总耗时 | 1496.690 ms | 471.040 ms | 459.618–510.965 ms | 68.5% | >= 30% |
| `check --staged` 总耗时 | 1386.240 ms | 507.697 ms | 465.046–526.408 ms | 63.4% | >= 30% |
| `check --worktree` 总耗时 | 1676.224 ms | 770.599 ms | 752.201–813.918 ms | 54.0% | >= 30% |
| `check --remote` 非网络 | 2488.479 ms | 812.148 ms | 778.105–826.022 ms | 67.4% | >= 35% |

Remote 基线非网络值使用调研所记录的中位数分解：
`3945.913 - 1457.434 = 2488.479 ms`。非验收路径
`list-ideas --all` 从 973.335 ms 降至 939.751 ms（3.5%）。

## After 全部样本

以下为最终可比组的全部 45 个 measured samples，单位均为 ms。

| 路径 | 样本 1 | 样本 2 | 样本 3 | 样本 4 | 样本 5 | 中位数 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 默认 `list-ideas` | 754.952 | 805.781 | 805.046 | 707.467 | 713.640 | 754.952 |
| `list-ideas --all` | 847.210 | 952.217 | 939.751 | 933.025 | 1151.433 | 939.751 |
| bare aligned `whats-next` | 1705.210 | 1645.189 | 1323.088 | 1457.454 | 1274.151 | 1457.454 |
| selected aligned `whats-next` | 1306.117 | 1250.321 | 1389.425 | 1423.279 | 1870.307 | 1389.425 |
| `create-idea` | 1213.379 | 1138.119 | 1128.379 | 1086.712 | 1101.742 | 1128.379 |
| `check` HEAD | 459.618 | 510.965 | 475.551 | 465.246 | 471.040 | 471.040 |
| `check --staged` | 523.447 | 465.046 | 526.408 | 465.987 | 507.697 | 507.697 |
| `check --worktree` | 769.222 | 813.918 | 770.599 | 752.201 | 802.046 | 770.599 |
| `check --remote` | 1087.291 | 1093.946 | 1093.009 | 1074.968 | 1079.469 | 1087.291 |

Network paths 的每样本分解如下；验收使用每行非网络样本的独立中位数，
没有以 total median 减 network median 代替。

| 路径 | 指标 | 样本 1 | 样本 2 | 样本 3 | 样本 4 | 样本 5 | 中位数 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| bare `whats-next` | network | 346.607 | 358.040 | 286.451 | 275.285 | 264.251 | 286.451 |
| bare `whats-next` | 非网络 | 1358.603 | 1287.149 | 1036.637 | 1182.169 | 1009.900 | 1182.169 |
| selected `whats-next` | network | 316.823 | 275.950 | 283.009 | 308.414 | 387.580 | 308.414 |
| selected `whats-next` | 非网络 | 989.294 | 974.371 | 1106.416 | 1114.865 | 1482.727 | 1106.416 |
| `check --remote` | network | 270.607 | 315.841 | 266.987 | 265.930 | 267.321 | 267.321 |
| `check --remote` | 非网络 | 816.684 | 778.105 | 826.022 | 809.038 | 812.148 | 812.148 |

## 确定性指标

| 路径 | 每样本 Git process | 每样本 materialization | 额外计数 |
| --- | ---: | ---: | --- |
| 默认 `list-ideas` | 5 | 0 | `candidateCount=2`；`titleReadCount=2` |
| `list-ideas --all` | 5 | 0 | `candidateCount=32`；`titleReadCount=32` |
| bare / selected `whats-next` | 8 | 0 | 各恰好 1 个 network fetch |
| `create-idea` | 8 | 0 | local readiness 恰好 2 个 Git process |
| `check` HEAD / staged | 4 | 0 | 无 `checkout-index` |
| `check --worktree` | 6 | 0 | 无 `checkout-index` |
| `check --remote` | 8 | 0 | 恰好 1 个 fetch；无 bootstrap materialization |

所有 process、materialization 和 title-read 计数在各自 5 个样本中完全一致。
Branch-name corpus 还证明纯结构校验保留
`git check-ref-format --branch` 语义以及 Silvermoon 的额外 reserved-name
规则，因此最终路径安全消除了原先每个 observation 的隐藏 Git process。

原始 45 份 after trace、summary 和不参与阈值计算的 C: 自检组仅保存在
session artifact，未提交到 repository。
