---
title: "可能存在更新的设备级 runtime"
description: "当前无法确认已安装的 Silvermoon runtime 对其 npm channel 是最新版本。"
instruction: "目标是在不修改项目依赖的前提下，让设备级 runtime 与已安装 channel 保持一致。比较报告的当前版本和最新版本；可选方法包括在同一 channel 升级全局 package，或把 host-managed runtime 留给其 host 管理。最后通过 `silvermoon` 验证所选路径。"
---

## 问题说明

当前无法确认设备级 runtime 对其已安装 npm channel 是最新版本。Problem fact
会在可用时给出观测到的版本和 channel。

期望结果是当前的设备级 runtime，而不是项目依赖。根据观测到的安装 owner 选择
合适的升级方法，再通过 `silvermoon` 验证。
