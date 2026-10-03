# Scaffold writes

Create idea directories/files exclusively and clean up only still-owned output.
[index.js](./index.js) exports allocation, writing and cleanup helpers.

Consume explicit plans from the idea module and injected/default filesystem
operations. Preserve collisions, concurrent edits and partial-failure evidence.

Do not merge scaffold ownership cleanup with state transactions or delete unknown
paths to make a retry succeed.
