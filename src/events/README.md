# Persistent event infrastructure

Read segmented streams, verify history and derive authenticated projections.
[index.js](./index.js) exports event infrastructure; [rules](./rules/README.md)
provides a separate pure protocol entrypoint.

Use repository/project entrypoints. Keep 1000-record segments, canonical bytes,
folder Git digests, precise cursors and SHA-1/SHA-256 support.

Caches/cursors are not authority. Writes and recovery are orchestrated by the
application; never silently reset a cursor or replay a stale decision.
