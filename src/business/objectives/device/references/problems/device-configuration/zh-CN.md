---
title: "设备配置无效"
description: "个人级 Silvermoon 配置不满足判断设备整备状态所需的 contract。"
instruction: "目标是让报告的配置对当前 runtime 有效。先根据上方说明确认不满足的 contract，再只修正受影响的 YAML 字段；如果是版本不匹配，可考虑改为 `version: 1`。保留无关偏好，随后通过 `silvermoon` 重试以验证配置。"
---

## 问题说明

个人级 Silvermoon 配置当前无法用于判断设备整备状态。Problem fact 会指出文件位置，
并解释观测到的 contract 不匹配。

期望结果是保留无关偏好的有效 YAML。根据报告的问题选择最小修复；缺少版本或版本
不受支持时，通常可改为 `version: 1`。
