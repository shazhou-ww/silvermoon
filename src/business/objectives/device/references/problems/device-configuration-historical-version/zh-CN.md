---
title: "个人配置版本过旧"
description: "个人级 Silvermoon 配置使用当前 binary 仍能识别为历史版本的旧 contract。"
instruction: "目标是让个人配置使用当前 runtime 支持的版本，并符合该版本的 config contract。保留现有偏好，参考 `silvermoon reference page:user-configuration --language zh-CN` 升级报告的配置文件，随后通过 `silvermoon` 重试。"
---

## 问题说明

Problem fact 给出配置路径、观测版本和当前 runtime 支持的版本。
升级配置时保留仍有效的偏好，不要只改版本号而保留已经失效的旧结构。

完整格式与示例：
`silvermoon reference page:user-configuration --language zh-CN`。
