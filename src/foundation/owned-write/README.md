# owned-write

Create scaffolds exclusively and clean only content still owned by the operation.

## Capability boundary

- Allowed dependencies: scaffold-plan and filesystem primitives.
- Does not own: event appends and generic file writes.
- Cross-module callers use [index.js](./index.js); sibling implementations do not import their own index.

## Key exports

- `createScaffold`: applies one scaffold plan with exclusive ownership checks.
- `cleanupScaffold`: removes only operation-owned content after a failed create.
- `cleanupSummary`: projects cleanup results into explicit evidence.
