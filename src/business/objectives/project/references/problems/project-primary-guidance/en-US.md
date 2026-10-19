---
title: "Primary guidance is unavailable or invalid"
description: "The refreshed primary cannot provide valid repository-owned phase guidance."
instruction: "First satisfy repository readiness, then repair only the guidance diagnostics observed from the exact primary snapshot."
---

## Problem guidance

This check validates guidance from refreshed primary, not the mutable
worktree. Keep the repair bound to the reported primary revision.
