# trace

Publish structured trace records and explicit timing facts.

## Capability boundary

- Allowed dependencies: terminal and filesystem sinks.
- Does not own: command state storage and log-driven business control.
- Cross-module callers use [index.ts](./index.ts); sibling implementations do not import their own index.

## Key exports

- `traceAsync`: measures one async operation and publishes structured timing facts.
- `withTraceFile`: runs a callback with a bounded JSONL trace sink.
- `emitTrace`: publishes one validated trace record.
