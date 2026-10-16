---
title: "The runtime required by project configuration cannot be confirmed"
description: "Project configuration declares a version this CLI cannot read, but npm registry freshness is unavailable."
---

The goal is to confirm the latest Silvermoon CLI for the active npm channel before deciding whether
project configuration is newer or simply wrong. Restore registry freshness and do not modify project
metadata while the result is unknown.

## Problem guidance

This is a failed classification prerequisite, not migration authorization.
Restore the registry check and reobserve before choosing a CLI upgrade or a
configuration version repair.
