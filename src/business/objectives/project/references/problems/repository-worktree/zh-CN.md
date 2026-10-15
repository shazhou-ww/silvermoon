---
title: "Repository worktree 尚未 clean"
description: "当前 worktree 存在冲突、修改或检查失败，无法安全推进。"
instruction: "保留未知工作，解决冲突或归类修改，并在继续前验证 worktree clean。"
---

## 问题说明

当前 repository 的 Git 状态还不能让 Silvermoon 安全推进 repository 或 Idea 工作。
Problem fact 会说明具体阻塞，并在适用时给出受影响路径或分支身份。

先保留未知工作。期望状态是 clean、已附着到本地分支，并跟踪配置的 primary；
具体方法取决于报告的阻塞。

稳定范围边界见 [[system/overview|Project Objective 总览]]。
