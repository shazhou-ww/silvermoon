# 让 whats-next 按上下文选择 Objective

## 问题

`whats-next` 当前把 Project terminal 与 active idea 导航混合，也无法在 Git worktree
之外自然表达 Device 整备目标，导致 Agent 在目标已完成后仍收到人为选择任务。

## 结果

无 selector 时按路径上下文选择目标：Git worktree 外追求 Device，worktree 内追求
Project；显式 selector 才追求 Idea。任一 Objective 达到 terminal 即无必做下一步，
idea 发现由 `list-ideas` 负责。

## 边界

- Git worktree 决定 Project subject；是否存在 `.silvermoon` 由 Project adoption check 判断。
- 只有明确的 outside-worktree 结果选择 Device；Git 检查失败必须显式报错。
- Project/Idea 目标中的 Device readiness 保持 advisory，不成为隐式 prerequisite。

## 验收标准

- Docker/CLI 场景证明 worktree 外、未 adoption worktree、ready Project 和显式 Idea 各自选择正确 Objective。
- bare `whats-next` 在 Device 或 Project terminal 时不列 active ideas，也不给 Agent 必做动作。
- selector 在 worktree 外得到明确 target-context 错误，现有 `list-ideas` 与显式 Idea 流程保持可用。
