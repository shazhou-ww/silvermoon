---
title: "Project configuration content does not satisfy its schema"
description: "The project configuration version is recognized, but `.silvermoon/config.yaml` does not satisfy that version's schema."
---

The goal is for project configuration content to satisfy the schema for its declared version.
Preserve valid primary and language settings, then repair the observed field or YAML issue using
`silvermoon reference page:project-metadata --language en-US`.

## Problem guidance

This Problem covers a known version with invalid content, such as missing
required fields, unknown fields, invalid primary coordinates, or malformed
YAML. Problem facts identify the violated condition.
