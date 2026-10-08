# event-history

Verify primary prefixes, event-file Git digests, and history boundaries.

## Capability boundary

- Allowed dependencies: git, snapshot, event-codec, event-store, and idea-model.
- Does not own: history mutation and human authorization.
- Cross-module callers use [index.ts](./index.ts); sibling implementations do not import their own index.

## Key exports

- `inspectEventHistory`: validates project event history against the configured primary.
- `inspectProjectedEventHistory`: validates a projected append without rereading unrelated streams.
- `detectEventFormat`: identifies the source repository's internal event-type migration boundary.
- `localPrimary`: resolves the observed local tracking commit for the configured primary.
