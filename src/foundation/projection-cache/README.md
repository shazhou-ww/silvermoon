# projection-cache

Authenticate, read, and update disposable derived event projections.

## Capability boundary

- Allowed dependencies: event-codec, event-history, event-store, git, and snapshot.
- Does not own: becoming authority or masking source failures.
- Cross-module callers use [index.ts](./index.ts); sibling implementations do not import their own index.

## Key exports

- `projectEventSnapshot`: derives a verified event projection for one exact snapshot.
