---
title: "device-runtime"
description: "当前 Silvermoon runtime 无法通过 PATH 中的设备级 silvermoon 可执行文件运行。"
instruction: "source checkout 在该 checkout 中运行 pnpm setup:dev；其他情况运行 npm install --global silvermoon。确保 npm global bin 目录已加入 PATH，然后用 silvermoon 重试。"
---

## 问题说明

**device-runtime** 表示当前 runtime 未通过 `PATH` 中可发现的设备级
`silvermoon` 可执行文件进入。Problem facts 会给出 runtime 入口路径、版本，以及它
是否为 source checkout。

source checkout 在该 checkout 中运行 `pnpm setup:dev` 以链接 runtime；其他情况
运行 `npm install --global silvermoon` 完成全局安装。确保 npm global bin 目录已加入
`PATH`，然后用 `silvermoon` 重试同一命令。
