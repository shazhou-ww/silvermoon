---
title: "A newer device runtime may be available"
description: "The installed Silvermoon runtime is not confirmed current for its npm channel."
instruction: "The goal is to use a device runtime that is current for the installed channel without changing project dependencies. Compare the reported current and latest versions; possible approaches include upgrading the global package on that same channel or leaving a host-managed runtime to its host. Verify the selected path through `silvermoon`."
---

## Problem guidance

The device runtime is not confirmed current for its installed npm channel. The
Problem fact identifies the observed versions and channel when available.

The desired outcome is a current device-level runtime, not a project
dependency. Choose an upgrade method appropriate to the observed installation
owner, then verify it through `silvermoon`.
