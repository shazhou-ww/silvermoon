---
title: "active runtime 的 canonical skill 无法验证"
description: "当前 Silvermoon runtime 随包提供的 canonical skill 无法读取或计算内容 revision。"
instruction: "目标是让 active Silvermoon CLI package 可用，并让其随包 canonical skill 可读取且能计算 expected revision。先排查 active `silvermoon` executable、package root、上方 skill 路径和具体读取错误；磁盘或权限异常应先修复，否则运行 `npm install --global silvermoon@latest` 重装最新版 CLI。达到目标后再修复 personal registration，并通过 `silvermoon` 重试。"
---

## 问题说明

可能原因包括 package 安装损坏、skill folder 被删除，以及磁盘或权限访问异常。
这不是 personal skill 缺失或版本不一致；必须先检查并修复 active package。
