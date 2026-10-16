---
title: "Device runtime unavailable on PATH"
description: "The current Silvermoon runtime did not run through a device-level `silvermoon` executable discoverable on `PATH`."
---

The goal is to make the intended device runtime reliably reachable through the `silvermoon`
executable on `PATH`. Possible approaches include using `pnpm setup:dev` from the reported checkout
when the active runtime is a source checkout, or installing it with
`npm install --global silvermoon` otherwise. Confirm that the global npm bin directory is on `PATH`,
then use `silvermoon` to verify the result.

## Problem guidance

The current runtime did not enter through a device-level `silvermoon`
executable discoverable on `PATH`. The Problem fact identifies the runtime
entry, version, source, and checkout root when available.

The desired outcome is a stable device-level entry on `PATH`. Depending on the
observed source, possible recovery methods include linking the reported
checkout with `pnpm setup:dev` or installing a global runtime with
`npm install --global silvermoon`. Verify the chosen repair by rerunning the
request through `silvermoon`.
