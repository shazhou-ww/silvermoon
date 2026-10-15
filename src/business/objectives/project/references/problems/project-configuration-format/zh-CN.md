---
title: "项目配置内容不符合 schema"
description: "项目配置版本可识别，但 `.silvermoon/config.yaml` 的内容不符合该版本 schema。"
instruction: "目标是让项目配置内容符合其声明版本的 schema。保留有效 primary 与语言设置，参考 `silvermoon reference page:project-metadata --language zh-CN` 修复观测到的字段或 YAML 问题。"
---

## 问题说明

本 Problem 用于版本已知但内容无效的情况，例如缺少必需字段、未知字段、primary
格式错误或 YAML 无效。具体违反项来自 Problem facts。
