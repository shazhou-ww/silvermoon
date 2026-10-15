---
title: "Device runtime unavailable on PATH"
description: "The current Silvermoon runtime did not run through a device-level `silvermoon` executable discoverable on `PATH`."
instruction: "If Current runtime is marked as a source checkout, run `pnpm setup:dev` from the Source checkout path shown above; otherwise run `npm install --global silvermoon`. Ensure the global npm bin directory is on `PATH`, then rerun with `silvermoon`."
---

## Problem guidance

The current runtime did not enter through a device-level `silvermoon`
executable discoverable on `PATH`. The Problem facts identify the runtime
entry, version, and whether it comes from a source checkout.

If Current runtime is marked as a source checkout, run `pnpm setup:dev` from
the Source checkout path shown above. Otherwise install the device
runtime with `npm install --global silvermoon`. Ensure the global npm bin
directory is on `PATH`, then rerun the same command with `silvermoon`.
