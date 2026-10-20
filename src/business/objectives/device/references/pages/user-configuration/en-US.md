---
title: "Personal Silvermoon configuration format"
description: "The complete YAML contract and repair example for the current personal configuration."
---

## File location

The personal configuration is `~/.config/silvermoon/config.yaml` and must be a
readable regular file.

## Current format

```yaml
version: 1
preferredLanguage: en-US
```

- `version` is required and its current integer value is `1`.
- `preferredLanguage` is optional and must be a canonical BCP 47 language tag,
  such as `en` or `zh-CN`.
- Unknown fields are not allowed.
- Canonical order is `version`, then `preferredLanguage`, with LF line endings
  and a final newline.

Preserve the original file before repair. Migrate preferences that remain valid
and handle unrecognized content explicitly rather than silently discarding it.
