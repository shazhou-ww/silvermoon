---
title: "Device configuration is invalid"
description: "The personal Silvermoon configuration does not satisfy the contract required to determine device readiness."
---

The goal is to make the reported configuration valid for the current runtime. Review the stated
contract mismatch, then correct only the affected YAML field; for a version mismatch, a possible
repair is `version: 1`. Preserve unrelated preferences and rerun through `silvermoon` to verify the
configuration.

## Problem guidance

The personal Silvermoon configuration cannot currently be used for device
readiness. The Problem fact identifies the file and explains the observed
contract mismatch.

The desired outcome is valid YAML that preserves unrelated preferences. Use
the reported mismatch to choose the smallest repair; an unsupported or missing
version can normally be corrected to `version: 1`.
