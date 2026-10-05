# installation

Observe the current runtime source and whether a global Silvermoon executable exists.

## Capability boundary

- Allowed dependencies: process and filesystem primitives.
- Does not own: installing, upgrading, daemon probing, and project inspection.
- Cross-module callers use [index.js](./index.js); sibling implementations do not import their own index.

## Key exports

- `inspectInstallation`: finds a global executable and reports runtime source, path, and version facts.
- `classifyRuntimeSource`: classifies an explicit entry path as global, source-checkout, or other.
