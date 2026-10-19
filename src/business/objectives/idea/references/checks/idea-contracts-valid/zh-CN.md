---
title: "idea-contracts-valid"
description: "验证 idea-contracts-valid。"
---

## 检查内容

**idea-contracts-valid** 检查当前 subject 和本次 probe workspace 中的事实。
它判断对应进阶条件是否成立。通过表示条件在本次采样中成立；
失败返回稳定 Problem ID 与结构化 parameters。

该 check 可以执行必要的文件、Git 或网络观测，但不执行 remediation，
也不记录人工决定。
