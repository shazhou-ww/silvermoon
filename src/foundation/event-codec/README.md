# event-codec

Parse, validate, and serialize canonical event records and complete log bytes.

## Capability boundary

- Allowed dependencies: idea-model and coordinates.
- Does not own: Git history, storage I/O, and write authorization.
- Cross-module callers use [index.ts](./index.ts); sibling implementations do not import their own index.

## Key exports

- `parseIdeaEvents`: parses canonical event bytes into validated records.
- `serializeIdeaEvents`: serializes records into canonical event bytes.
- `validateIdeaEvent`: validates one event record and payload.
- `replayIdeaEvents`: reduces validated records while reporting exact protocol failures.
