---
title: "Personal Silvermoon skill content is not current"
description: "The personal Silvermoon skill is not installed or its content version is incorrect."
instruction: "The goal is for a personal discovery path to contain the Silvermoon skill shipped with the active runtime and for its content revision to match the canonical skill. Use the path reported above to run `npx skills add \"<canonical-skill-path>\" --global --all`, then rerun through `silvermoon`."
---

## Problem guidance

The Problem fact directly states whether no personal skill was found or a
discovered skill's deterministic content revision differs from the active
runtime's canonical skill. It identifies the canonical skill path, expected
revision, observed revision when readable, and discovery path.

The desired outcome is to use `npx skills` to install the skill shipped with
the current runtime from the reported canonical skill path so its content
revision matches. Paths and symlink targets are installation details, not the
correctness definition.
