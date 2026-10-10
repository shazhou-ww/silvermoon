# Deployment

## Steps

### D-S01: 接入分层 CI 门禁

让日常 pull request 流程优先提供快速 integration 反馈，并让 release 与 publish 流程继续执行完整风险层。

### D-S02: 观察 CI 耗时与稳定性

在真实 CI 环境记录各层耗时和结果，确认分层未引入遗漏、资源争用或新的不稳定性。

## Acceptance criteria

### D-AC01: 日常 CI 更快反馈

pull request 只执行快速 integration 和必要的 platform smoke；记录三个真实 CI 样本，并据此建立后续可比较的 job budget。

### D-AC02: 完整门禁持续生效

release 与 publish 工作流均可观察到完整 integration 层成功执行，且关键风险类别没有被快速层替代或跳过。

### D-AC03: 连续运行稳定

优化后的分层在目标 CI 环境连续三次运行全部通过且无重试；通过三次 workflow 结果和日志证明。

## Verification evidence

最终样本均运行 primary commit `cb2dea80b4fc`，`run_attempt=1` 且 overall
conclusion 为 success。此前探索样本暴露的两个并发问题已修复，不计入下表；
修复后重新从零连续采样。

| Run | Workflow | Fast job / step | Extended job / step | Platform smoke |
| --- | ---: | ---: | ---: | ---: |
| [38035360513](https://github.com/shazhou-ww/silvermoon/actions/runs/38035360513) | 242 秒 | 31 / 17 秒 | 41 / 23 秒 | 6 项通过，2–11 秒 |
| [38035363007](https://github.com/shazhou-ww/silvermoon/actions/runs/38035363007) | 265 秒 | 43 / 21 秒 | 34 / 18 秒 | 6 项通过，2–13 秒 |
| [38035365238](https://github.com/shazhou-ww/silvermoon/actions/runs/38035365238) | 282 秒 | 45 / 19 秒 | 32 / 18 秒 | 6 项通过，2–12 秒 |

### 优化前对照

基线选择优化提交之前最近三次成功的同类 `workflow_dispatch`：
[37878421830](https://github.com/shazhou-ww/silvermoon/actions/runs/37878421830)、
[37746594938](https://github.com/shazhou-ww/silvermoon/actions/runs/37746594938) 和
[37478506244](https://github.com/shazhou-ww/silvermoon/actions/runs/37478506244)。
三次均为 `run_attempt=1`，并使用完全相同的优化前 CI workflow blob
`a9427c639eca`。优化后三次使用同一 workflow blob `4c8f1fc25b51`、
同一触发方式和相同 OS/Node matrix；workflow 内容的差异正是本次分层改动。

| 口径 | 优化前样本 | 优化后样本 | 中位变化 |
| --- | --- | --- | --- |
| Workflow wall time | 234、280、377 秒 | 242、265、282 秒 | 280 → 265 秒，降低 5.4% |
| 主 integration job | 49、53、68 秒 | 31、43、45 秒 | 53 → 43 秒，降低 18.9% |
| 主 integration test step | 32、33、43 秒 | 17、21、19 秒 | 33 → 19 秒，降低 42.4% |
| Matrix integration step（18 项） | 9–141 秒，中位 22.5 秒 | 2–13 秒，中位 4 秒 | 降低 82.2% |
| Integration step runner time 合计 | 164、190、421 秒 | 74、72、73 秒 | 190 → 73 秒，降低 61.6% |

整体 workflow 的降幅小于 integration step，因为其关键路径还包含未改动的
unit、contract 和 package jobs，且 manual workflow 在优化后新增了独立
extended job。尽管完整风险层仍执行，workflow 最大样本从 377 秒降至
282 秒，integration 相关 runner time 与跨平台尾部耗时均明显收敛。

后续回归预算以同类 GitHub-hosted runner 的 job wall time 为准：fast job
不超过 60 秒，extended job 不超过 60 秒，单个 platform smoke step 不超过
20 秒；完整 workflow 的观察预算为 360 秒。最大样本相对上述预算仍分别
保留 25%、31.7%、35% 和 21.7% 的余量。

CI contract 验证 pull request 跳过 extended、required job 接受该 skip，
schedule 与 manual dispatch 则要求 extended 成功。上述三次 manual
workflow 的 fast、extended 和 18 个 platform matrix step 均成功；
release-grade `pnpm check` 与 publish workflow contract 也验证 complete
non-live integration 入口持续生效。
