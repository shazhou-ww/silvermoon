---
title: "项目配置版本号错误"
description: "`.silvermoon/config.yaml` 没有声明当前已支持的有效 schema 版本。"
---

目标是让项目配置声明当前支持的版本并符合该版本 contract。参考 `silvermoon reference page:project-metadata --language zh-CN`
修复配置；这不是等待 CLI 更新。

## 问题说明

版本可能不是有效的正整数、不是已支持的历史版本，或 registry 已确认最新 CLI 仍不
支持它。Agent 应按当前 project contract 修正，而不是反复尝试升级。
