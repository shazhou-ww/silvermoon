---
title: "Project configuration version is wrong"
description: "`.silvermoon/config.yaml` does not declare a valid currently supported schema version."
---

The goal is for the project configuration to declare a supported version and satisfy that contract.
Repair it using `silvermoon reference page:project-metadata --language en-US`; this is not a pending
CLI update.

## Problem guidance

The version may not be a positive safe integer, may not be a supported
historical version, or may remain unsupported after the registry confirms the
latest CLI. Repair it against the current project contract rather than retrying
upgrades.
