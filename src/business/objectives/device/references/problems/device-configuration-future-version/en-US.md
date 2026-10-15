---
title: "Personal configuration version is newer than this binary supports"
description: "The personal Silvermoon configuration declares a version newer than the current binary supports."
instruction: "The goal is for the active Silvermoon CLI to support the version declared by the personal configuration. The npm registry result above reports an available update; upgrade the device-level Silvermoon CLI, then rerun through `silvermoon` so the newer runtime can validate that configuration contract."
---

## Problem guidance

The Problem fact identifies the configuration version, current binary version,
supported version, and whether the npm registry reports a newer Silvermoon CLI.
Only an available release establishes that the binary is stale. If the registry
confirms the current release is latest, the configuration version itself is
wrong.

For the current configuration contract, run
`silvermoon reference page:user-configuration --language en-US`.
