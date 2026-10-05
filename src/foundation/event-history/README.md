# event-history

Verify primary prefixes, folder Git digests, and event history boundaries.

## Capability boundary

- Allowed dependencies: git, snapshot, event-codec, event-store, and idea-model.
- Does not own: history mutation and human authorization.
- Cross-module callers use [index.js](./index.js); sibling implementations do not import their own index.

## Key exports

- `inspectEventHistory`: validates project event history against the configured primary.
- `inspectProjectedEventHistory`: validates a projected append without rereading unrelated streams.
- `eventFolderDigest`: computes the Git-compatible digest of canonical event-folder entries.
- `localPrimary`: resolves the observed local tracking commit for the configured primary.
