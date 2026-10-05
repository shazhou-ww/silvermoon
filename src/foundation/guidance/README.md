# guidance

Read fixed phase guidance and bind it to an exact content revision.

## Capability boundary

- Allowed dependencies: coordinates and snapshot readers.
- Does not own: executing Markdown, selecting next steps, and lifecycle decisions.
- Cross-module callers use [index.js](./index.js); sibling implementations do not import their own index.

## Key exports

- `inspectPhaseGuidance`: reads one phase guidance file with provenance and diagnostics.
- `inspectAllGuidance`: validates every fixed guidance file in a selected snapshot.
