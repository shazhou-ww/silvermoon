---
title: "The active runtime's canonical skill cannot be verified"
description: "The canonical skill shipped with the active Silvermoon runtime cannot be read or assigned a content revision."
instruction: "The goal is for the active Silvermoon CLI package to be usable and for its bundled canonical skill to be readable with a verifiable expected revision. Inspect the active `silvermoon` executable, package root, reported skill path, and concrete read failure; repair disk or permission failures, or reinstall the latest CLI with `npm install --global silvermoon@latest`. After reaching the goal, repair personal registration and rerun through `silvermoon`."
---

## Problem guidance

Silvermoon cannot establish an expected revision from the canonical skill
shipped with the active runtime. Possible causes include a damaged package
installation, a deleted skill folder, and disk or permission failures. This is
not a missing or stale personal skill. The Agent must inspect the active package
first; reinstalling a registration from a damaged canonical source cannot
repair it.
