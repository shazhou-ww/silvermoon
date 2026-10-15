---
title: "device-runtime"
description: "The current Silvermoon runtime is not available through a device-level silvermoon executable on PATH."
instruction: "For a source checkout, run pnpm setup:dev from that checkout; otherwise run npm install --global silvermoon. Ensure the global npm bin directory is on PATH, then rerun with silvermoon."
---

## Problem guidance

**device-runtime** means the current runtime did not enter through a device-level
`silvermoon` executable discoverable on `PATH`. The Problem facts identify the
runtime entry path, version, and whether it is a source checkout.

For a source checkout, run `pnpm setup:dev` from that checkout to link the
runtime. Otherwise install it with `npm install --global silvermoon`. Ensure the
global npm bin directory is on `PATH`, then rerun the same command with
`silvermoon`.
