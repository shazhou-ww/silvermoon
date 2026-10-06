# package-resource

Inspect packaged tarballs and locate static resources shipped with Silvermoon.

## Capability boundary

- Allowed dependencies: process and filesystem primitives.
- Does not own: project worktree reads and business parsing.
- Cross-module callers use [index.ts](./index.ts); sibling implementations do not import their own index.

## Key exports

- `inspectNpmTarball`: reads and validates npm tarball metadata and file entries.
- `requiredEntry`: returns one required packaged entry or fails explicitly.
