# coordinates

Validate repository URLs, Git object IDs, ULIDs, and canonical relative metadata paths.

## Capability boundary

- Allowed dependencies: no I/O dependencies.
- Does not own: business composition and generic utilities.
- Cross-module callers use [index.ts](./index.ts); sibling implementations do not import their own index.

## Key exports

- `canonicalRepository`: normalizes a supported repository URL.
- `ideaPaths`: returns canonical metadata paths for one validated idea ID.
- `validBranchName`: validates an explicit Git branch name.
