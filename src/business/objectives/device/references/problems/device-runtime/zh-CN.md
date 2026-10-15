---
title: "`PATH` 中的设备级 runtime 不可用"
description: "当前 Silvermoon runtime 未通过 `PATH` 中可发现的设备级 `silvermoon` 可执行文件运行。"
instruction: "如果当前 runtime 标记为 source checkout，在上方显示的 Source checkout 路径运行 `pnpm setup:dev`；其他情况运行 `npm install --global silvermoon`。确保 npm global bin 目录已加入 `PATH`，然后用 `silvermoon` 重试。"
---

## 问题说明

当前 runtime 未通过 `PATH` 中可发现的设备级 `silvermoon` 可执行文件运行。
Problem facts 会给出 runtime 入口、版本，以及它是否来自 source checkout。

如果当前 runtime 标记为 source checkout，在上方显示的 Source checkout
路径运行 `pnpm setup:dev`；其他情况运行 `npm install --global silvermoon`。确保
npm global bin 目录已加入 `PATH`，然后用 `silvermoon` 重试同一命令。
