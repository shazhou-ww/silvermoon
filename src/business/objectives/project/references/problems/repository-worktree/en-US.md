---
title: "Repository worktree is not clean"
description: "The worktree has conflicts, changes, or an inspection failure that prevents safe advancement."
instruction: "Preserve unknown work, resolve conflicts or classify changes, and verify a clean worktree before continuing."
---

## Problem guidance

The repository is not yet in a Git state from which Silvermoon can safely
advance repository or Idea work. The Problem fact supplies the specific
observed blocker, including affected paths or branch identity when relevant.

Preserve unknown work first. The desired state is a clean, attached local
branch tracking the configured primary; the appropriate method depends on the
reported blocker.

For the stable scope boundary, read [[system/overview|the Project Objective overview]].
