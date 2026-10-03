# Event orchestration

Coordinate complete replay, local/incremental writes, metadata changes and recovery.
[index.js](./index.js) exposes these helpers to application commands.

Use observation, protocol, project and repository entrypoints. Bind writes to
exact stream coordinates, applicable primary/world revisions and explicit decisions.

Do not replace incrementality with full-history scans or bypass transaction,
owned-suffix, stale-request or unknown-byte protection.
