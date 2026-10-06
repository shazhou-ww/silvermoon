# command-message

Reduce one invocation's messages and enforce action ordering invariants.

## Capability boundary

- Allowed dependencies: report, schema, and trace.
- Does not own: persistent idea events, terminal output, and repository policy.
- Cross-module callers use [index.ts](./index.ts); sibling implementations do not import their own index.

## Key exports

- `createCommandRun`: creates a per-run closure over ordered command messages.
- `reduceObservation`: reduces one command message into immutable internal state.
- `projectActions`: projects paired requested and finished actions.
- `projectReport`: projects the final four-part report from a completed stream.
