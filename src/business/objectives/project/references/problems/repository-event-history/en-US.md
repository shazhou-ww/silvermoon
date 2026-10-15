---
title: "Idea event history is invalid"
description: "One or more Idea event logs do not preserve the required append-only history."
instruction: "Inspect the reported Idea and history result; preserve concurrent events and repair only through the documented exceptional workflow."
---

## Problem guidance

Do not truncate, renumber, or silently replay events. Reconcile the exact base
and candidate histories before continuing.
