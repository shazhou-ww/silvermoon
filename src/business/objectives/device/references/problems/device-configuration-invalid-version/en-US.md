---
title: "Personal configuration version is wrong"
description: "The personal Silvermoon configuration does not declare a valid currently supported version."
instruction: "The goal is for the reported personal configuration to declare a currently supported version and satisfy that version's configuration contract. Consult `silvermoon reference page device pages/user-configuration --language en-US`, preserve preferences that remain valid, correct the file, and then rerun through `silvermoon`."
---

## Problem guidance

The configuration version may not be a valid integer, or it may declare a
version for which the registry confirms no newer supporting CLI exists. The
Agent must not treat this as an ordinary update prompt; repair the version and
content against the current configuration contract.
