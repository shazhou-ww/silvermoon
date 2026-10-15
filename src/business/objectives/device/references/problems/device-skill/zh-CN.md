---
title: "个人级 Silvermoon skill 不可发现"
description: "当前没有可用的个人级 skill registration 解析到 active runtime 的 canonical Silvermoon skill。"
instruction: "目标是让一个个人级 skill discovery 路径解析到上方报告的 canonical skill。可选方法包括：已安装 runtime 可使用 `silvermoon-link-skill`，source checkout 可使用 `pnpm link:skill`。替换不匹配的既有路径前先检查其内容，随后通过 `silvermoon` 重试以验证 discovery。"
---

## 问题说明

Silvermoon 没有找到指向 active runtime canonical skill 的可用个人级 registration。
Problem fact 会给出 canonical skill 和已观测到的个人级路径。

期望结果是至少有一个个人级 discovery 链接解析到该 canonical skill。已安装
runtime 可考虑 `silvermoon-link-skill`，source checkout 可考虑
`pnpm link:skill`；替换不匹配的路径前应先检查其内容。
