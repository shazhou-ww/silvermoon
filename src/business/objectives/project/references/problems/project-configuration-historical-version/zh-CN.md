---
title: "项目配置版本过旧"
description: "`.silvermoon/config.yaml` 使用可读取但需要迁移的历史 schema 版本。"
---

目标是让项目配置使用当前 target 版本并符合该版本 contract。参考
`silvermoon reference page:project-metadata --language zh-CN`，保留 primary 与语言设置，按报告的 migration path
完成迁移。

## 问题说明

Problem facts 给出历史版本、当前 target 和声明的 migration path。迁移必须遵循
Silvermoon schema capability，不要只修改 `version` 字段。
