# event-store

Read and plan segmented event storage at the 1000-record boundary.

## Capability boundary

- Allowed dependencies: event-codec, event-history digest primitives, and snapshot.
- Does not own: payload policy, fetch, and full command orchestration.
- Cross-module callers use [index.ts](./index.ts); sibling implementations do not import their own index.

## Key exports

- `readEventStorage`: reads one complete authoritative segmented stream.
- `eventStorageChanges`: plans exact filesystem changes for candidate bytes.
- `EventStream`: indexes canonical records across fixed-size segments.
- `snapshotEventPrefix`: reads an exact canonical prefix from a snapshot.
- `eventFolderDigest`: computes the Git-compatible digest for canonical segmented storage entries.
