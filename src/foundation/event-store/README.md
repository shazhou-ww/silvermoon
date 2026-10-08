# event-store

Read and plan one authoritative `events.jsonl` file.

## Capability boundary

- Allowed dependencies: event-codec, event-history digest primitives, and snapshot.
- Does not own: payload policy, fetch, and full command orchestration.
- Cross-module callers use [index.ts](./index.ts); sibling implementations do not import their own index.

## Key exports

- `readEventStorage`: reads one complete authoritative event file.
- `eventStorageChanges`: plans exact filesystem changes for candidate bytes.
- `snapshotEventPrefix`: reads an exact canonical prefix from a snapshot.
- `gitContentDigest`: computes the Git-compatible blob digest for exact event bytes.
