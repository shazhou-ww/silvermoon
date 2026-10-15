---
title: "Personal configuration format is invalid"
description: "The personal Silvermoon configuration does not satisfy the YAML contract for its current version."
instruction: "The goal is for the personal configuration content to satisfy the schema and canonical YAML format for its declared version. Preserve the original file for comparison, rewrite the reported file using `silvermoon reference page device pages/user-configuration --language en-US`, then rerun through `silvermoon`."
---

## Problem guidance

The Problem fact identifies the configuration path and violated format rules.
Preserve preferences that remain valid, remove unknown fields, and rewrite the
file as canonical YAML. Do not silently discard content that cannot be mapped.

For the complete format and example, run
`silvermoon reference page device pages/user-configuration --language en-US`.
