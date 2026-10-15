---
title: "个人配置格式不正确"
description: "个人级 Silvermoon 配置没有满足当前版本的 YAML contract。"
instruction: "目标是让个人配置内容符合其已声明版本的 config schema 和 canonical YAML 格式。保留原文件供核对，参考 `silvermoon reference page:user-configuration --language zh-CN` 重写报告的配置文件，随后通过 `silvermoon` 重试。"
---

## 问题说明

Problem fact 给出配置路径和实际违反的格式规则。修复时应保留仍有效的偏好，
移除未知字段，并把文件重写为当前 canonical YAML；不要静默删除无法识别的内容。

完整格式与示例：
`silvermoon reference page:user-configuration --language zh-CN`。
