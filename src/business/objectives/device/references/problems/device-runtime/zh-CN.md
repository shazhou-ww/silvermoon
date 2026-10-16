---
title: "`PATH` 中的设备级 runtime 不可用"
description: "当前 Silvermoon runtime 未通过 `PATH` 中可发现的设备级 `silvermoon` 可执行文件运行。"
---

目标是让预期的设备级 runtime 能够通过 `PATH` 中的 `silvermoon` 可执行文件稳定访问。可选方法包括：当前 runtime 来自 source checkout 时，在报告的
checkout 中使用 `pnpm setup:dev`；其他情况可使用 `npm install --global silvermoon` 安装。确认 npm global bin 目录位于
`PATH` 后，再通过 `silvermoon` 验证结果。

## 问题说明

当前 runtime 未通过 `PATH` 中可发现的设备级 `silvermoon` 可执行文件运行。
Problem fact 会给出 runtime 入口、版本、来源，以及可用时的 checkout 根目录。

期望结果是获得一个在 `PATH` 中稳定可用的设备级入口。可根据观测来源选择恢复方法：
用 `pnpm setup:dev` 链接报告的 checkout，或用
`npm install --global silvermoon` 安装全局 runtime。最后通过 `silvermoon`
重试原请求，验证所选修复是否有效。
