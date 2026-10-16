---
title: "Project configuration version is historical"
description: "`.silvermoon/config.yaml` uses a readable historical schema version that requires migration."
---

The goal is for the project configuration to use the current target version and satisfy that
contract. Consult `silvermoon reference page:project-metadata --language en-US`, preserve primary
and language settings, and follow the reported migration path.

## Problem guidance

Problem facts identify the historical version, current target, and declared
migration path. Follow Silvermoon schema capability; do not edit only the
`version` field.
