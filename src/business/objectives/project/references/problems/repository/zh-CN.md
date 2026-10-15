---
title: "Repository 尚未满足安全工作条件"
description: "当前 repository 尚未满足安全推进 repository 或 Idea 工作所需的 Git 状态。"
instruction: "目标是在保留未知工作的前提下，得到 clean、已附着到本地分支且 upstream 与配置 primary 一致的 repository。"
---

## 问题说明

当前 repository 的 Git 状态还不能让 Silvermoon 安全推进 repository 或 Idea 工作。
Problem fact 会说明具体阻塞，并在适用时给出受影响路径或分支身份。

先保留未知工作。期望状态是 clean、已附着到本地分支，并跟踪配置的 primary；
具体方法取决于报告的阻塞。

稳定范围边界见 [[system/overview|Project Objective 总览]]。
