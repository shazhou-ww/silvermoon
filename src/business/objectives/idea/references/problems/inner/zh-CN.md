---
title: "实现尚未达到要求状态"
description: "当前 implementation revision 尚未按下一生命周期步骤的要求完成提交或验收。"
instruction: "目标是让准确的当前 implementation revision 为下一 gate 就绪。根据当前状态继续实现或 review；证据就绪后，把该 revision 同步到 primary，并在推进前记录匹配的生命周期事件。"
---

## 问题说明

当前 implementation revision 尚未达到下一 gate 所需的生命周期状态。Problem
fact 会指出准确 revision 和要求状态。

期望结果是已同步且拥有匹配生命周期事件的当前 revision。根据报告状态和控制权选择
继续实现、提交或 review。
