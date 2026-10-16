---
title: "个人配置版本超出当前 binary 支持范围"
description: "个人级 Silvermoon 配置声明的版本比当前 binary 支持的版本更新。"
---

目标是让 active Silvermoon CLI 支持个人配置声明的版本。上方 npm registry 已报告可用的更新版本；升级 device-level Silvermoon CLI
后，通过 `silvermoon` 重试并由新版 runtime 验证该 config contract。

## 问题说明

Problem fact 给出配置版本、当前 binary 版本、受支持版本，以及 npm registry
是否报告了更新的 Silvermoon CLI。只有 registry 报告新版时才能把问题归因于
binary 过时；registry 确认当前版本已最新，则配置版本号本身错误。

当前配置 contract：
`silvermoon reference page:user-configuration --language zh-CN`。
