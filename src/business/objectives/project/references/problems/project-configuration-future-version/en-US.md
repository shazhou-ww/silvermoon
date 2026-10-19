---
title: "Project configuration version is newer than this CLI supports"
description: "`.silvermoon/config.yaml` declares a schema version newer than the active CLI can read, and the registry reports an available update."
instruction: "The goal is for the active Silvermoon CLI to support the schema version declared by the project configuration. The npm registry reports an available update; upgrade the device-level CLI and let the newer runtime revalidate project metadata."
---

## Problem guidance

This Problem applies only when the registry proves that a newer CLI is
available. Upgrading the CLI must not modify project metadata; the newer runtime
decides whether the version is genuinely valid.
