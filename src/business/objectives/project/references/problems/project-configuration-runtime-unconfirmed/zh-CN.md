---
title: "无法确认项目配置版本所需的 runtime"
description: "项目配置声明了当前 CLI 无法读取的版本，但 npm registry freshness 不可用。"
---

目标是先确认 active npm channel 的最新 Silvermoon CLI，再判断 project config 是版本过新还是版本号错误。恢复 registry
freshness；不要在结果未知时修改 project metadata。

## 问题说明

这是分类前置条件失败，不是配置迁移授权。恢复 registry 检查后重新观察，才能选择
升级 CLI 或修正配置版本。
