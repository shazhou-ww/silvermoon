# schema-capability

Load the runtime-owned schema capability manifest and inspect project
schema-bearing files without selecting a project runtime or mutating metadata.

## Capability boundary

- Allowed dependencies: filesystem primitives and existing immutable
  validators for project config, idea status and idea events.
- Does not own: migration execution, npm freshness, repository hygiene, or
  lifecycle routing.
- Cross-module callers use [index.ts](./index.ts); sibling implementations do
  not import their own index.

## Key exports

- `loadSchemaCapabilityManifest`: validates and returns the packaged manifest.
- `inspectProjectSchemas`: reports per-file validity and current-target
  readiness.
- `classifySchemaVersion`: separates current, migratable, future and
  unsupported declarations.
