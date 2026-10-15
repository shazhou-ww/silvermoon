---
title: "Personal Silvermoon skill is not discoverable"
description: "No usable personal skill registration currently resolves to the canonical Silvermoon skill from the active runtime."
instruction: "The goal is to make one personal skill discovery path resolve to the canonical skill reported above. Possible approaches include using `silvermoon-link-skill` for an installed runtime or `pnpm link:skill` from a source checkout. Inspect a mismatched existing path before replacing it, then rerun through `silvermoon` to verify discovery."
---

## Problem guidance

Silvermoon could not find a usable personal registration for the active
runtime's canonical skill. The Problem fact identifies the canonical skill and
any observed personal paths.

The desired outcome is one personal discovery link that resolves to that
canonical skill. `silvermoon-link-skill` and `pnpm link:skill` are possible
methods for installed and source-checkout runtimes respectively; mismatched
paths should be inspected before replacement.
