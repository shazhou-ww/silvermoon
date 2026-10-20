---
title: "项目配置版本超出当前 CLI 支持范围"
description: "`.silvermoon/config.yaml` 声明的 schema 版本比 active CLI 的读取能力更新，并且 registry 已报告可用更新。"
instruction: "目标是让 active Silvermoon CLI 支持项目配置声明的 schema 版本。npm registry 已报告可用的更新版本；升级 device-level CLI 后，由新版 runtime 重新验证 project metadata。"
---

## 问题说明

只有 registry 证明存在更新的 CLI 时才使用本 Problem。升级 CLI 不应修改项目
metadata；由新版 runtime 判断该版本是否真实有效。
