---
title: "个人级 Silvermoon 配置格式"
description: "当前个人配置的完整 YAML contract 与修复示例。"
---

## 文件位置

个人配置位于 `~/.config/silvermoon/config.yaml`，必须是可读取的普通文件。

## 当前格式

```yaml
version: 1
preferredLanguage: zh-CN
```

- `version` 必填，当前值为整数 `1`。
- `preferredLanguage` 可选，必须是 canonical BCP 47 language tag，例如 `en` 或
  `zh-CN`。
- 不允许未知字段。
- canonical 顺序为 `version`、`preferredLanguage`，使用 LF 换行并以换行结尾。

修复前保留原文件供核对。只迁移仍有效的偏好，无法识别的内容必须显式处理，
不能静默丢弃。
