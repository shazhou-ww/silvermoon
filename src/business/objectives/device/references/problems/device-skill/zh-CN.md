---
title: "个人级 Silvermoon skill 内容不是当前版本"
description: "个人级 Silvermoon skill 未安装或内容版本不正确。"
instruction: "目标是让个人级 discovery 路径安装 active runtime 随包提供的 Silvermoon skill，并使其内容 revision 与 canonical skill 一致。使用上方报告的路径运行 `npx skills add \"<canonical-skill-path>\" --global --all`，然后通过 `silvermoon` 重试。"
---

## 问题说明

Problem fact 会直接说明本次是未发现个人级 skill，还是已发现 skill 但其确定性内容
revision 与 active runtime 的 canonical skill 不同，并给出 canonical skill 路径、
expected revision、可读取时的 observed revision 和 discovery 路径。

期望结果是用 `npx skills` 从报告的 canonical skill 路径安装当前 runtime 随包提供的
skill，并使内容 revision 一致。路径和 symlink target 是安装手段，不是正确性的定义。
