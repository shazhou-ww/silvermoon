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

后续回归预算以同类 GitHub-hosted runner 的 job wall time 为准：fast job
不超过 60 秒，extended job 不超过 60 秒，单个 platform smoke step 不超过
20 秒；完整 workflow 的观察预算为 360 秒。最大样本相对上述预算仍分别
保留 25%、31.7%、35% 和 21.7% 的余量。

CI contract 验证 pull request 跳过 extended、required job 接受该 skip，
schedule 与 manual dispatch 则要求 extended 成功。上述三次 manual
workflow 的 fast、extended 和 18 个 platform matrix step 均成功；
release-grade `pnpm check` 与 publish workflow contract 也验证 complete
non-live integration 入口持续生效。
