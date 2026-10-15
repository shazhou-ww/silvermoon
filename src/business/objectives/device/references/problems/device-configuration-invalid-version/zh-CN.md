---
title: "个人配置版本号错误"
description: "个人级 Silvermoon 配置没有声明当前已支持的有效版本。"
instruction: "目标是让报告的个人配置声明当前支持的版本，并符合该版本的 config contract。参考 `silvermoon reference page device pages/user-configuration --language zh-CN`，保留仍有效的偏好并修正配置文件，然后通过 `silvermoon` 重试。"
---

## 问题说明

配置版本号可能不是有效整数，也可能声明了 registry 已证明没有对应新版 CLI 支持的
版本。Agent 不应把它解释为普通更新提示；应参考当前配置 contract 修正版本和内容。
