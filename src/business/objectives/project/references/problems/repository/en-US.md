---
title: "Repository is not ready for safe work"
description: "The repository does not yet satisfy the Git state required to advance repository or Idea work safely; the observed condition below identifies the blocker."
instruction: "The goal is to reach a clean, attached local branch whose upstream matches the configured primary without losing unknown work. Use the observed condition to choose among preserving or classifying changes, switching or creating a branch, and configuring its remote/upstream. Verify the resulting repository state before continuing."
---

## Problem guidance

The repository is not yet in a Git state from which Silvermoon can safely
advance repository or Idea work. The Problem fact supplies the specific
observed blocker, including affected paths or branch identity when relevant.

Preserve unknown work first. The desired state is a clean, attached local
branch tracking the configured primary; the appropriate method depends on the
reported blocker.

For the stable scope boundary, read [[system/overview|the Project Objective overview]].
