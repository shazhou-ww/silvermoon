---
title: "个人配置版本号错误"
description: "个人级 Silvermoon 配置没有声明当前已支持的有效版本。"
instruction: "目标是让报告的个人配置声明当前支持的版本，并符合该版本的 config contract。参考 `silvermoon reference page device pages/user-configuration --language zh-CN`，保留仍有效的偏好并修正配置文件，然后通过 `silvermoon` 重试。"
---

## 问题说明

Agent 不应把错误版本号解释为普通更新提示；应参考当前配置 contract 修正。
