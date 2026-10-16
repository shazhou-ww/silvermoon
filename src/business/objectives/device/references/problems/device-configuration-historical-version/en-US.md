---
title: "Personal configuration version is historical"
description: "The personal Silvermoon configuration uses an older contract that the current binary recognizes as historical."
---

The goal is for the personal configuration to use a version supported by the current runtime and
satisfy that version's configuration contract. Preserve existing preferences and upgrade the
reported file using `silvermoon reference page:user-configuration --language en-US`, then rerun
through `silvermoon`.

## Problem guidance

The Problem fact identifies the configuration path, observed version, and the
version supported by the current runtime. Preserve preferences that remain
valid; do not only change the version number while retaining obsolete structure.

For the complete format and example, run
`silvermoon reference page:user-configuration --language en-US`.
