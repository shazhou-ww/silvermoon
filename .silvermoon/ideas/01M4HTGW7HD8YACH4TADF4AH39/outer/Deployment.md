# Deployment

## Steps

### D-S01: 接入分层 CI 门禁

让日常 pull request 流程优先提供快速 integration 反馈，并让 release 与 publish 流程继续执行完整风险层。

### D-S02: 观察 CI 耗时与稳定性

在真实 CI 环境记录各层耗时和结果，确认分层未引入遗漏、资源争用或新的不稳定性。

## Acceptance criteria

### D-AC01: 日常 CI 更快反馈

pull request 的日常 integration 门禁相对记录的同环境基线至少缩短 40%，并通过 CI job timing 证明。

### D-AC02: 完整门禁持续生效

release 与 publish 工作流均可观察到完整 integration 层成功执行，且关键风险类别没有被快速层替代或跳过。

### D-AC03: 连续运行稳定

优化后的分层在目标 CI 环境连续三次运行全部通过且无重试；通过三次 workflow 结果和日志证明。
