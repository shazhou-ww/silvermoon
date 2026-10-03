# Command runtime

Own one invocation's ordered intention, observation, action and response lifecycle.
[index.js](./index.js) preserves the runtime API and CommandRun compatibility.

Use [rules](./rules/README.md) for pure reduction/projection and
[trace](./trace/README.md) for message/timing publication.
Per-run closures preserve nested action pairing without stale-state replacement.

Command messages are not persistent idea events and do not authorize decisions.
