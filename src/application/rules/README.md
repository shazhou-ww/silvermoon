# Readiness rules

Evaluate local repository facts and primary relationships without real I/O.
[index.js](./index.js) exports the pure readiness functions.

Inputs provide observed facts and retry intent. Dependencies are pure response
and project rule entrypoints, not Git, command runtime or observation readers.

Creation accepts any correctly tracked local branch; fetching belongs to the
application shell after local readiness passes.
