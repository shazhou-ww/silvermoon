# schema

Validate explicit structured schema version values.

## Capability boundary

- Allowed dependencies: coordinates.
- Does not own: YAML parsing, business readiness, and automatic repair.
- Cross-module callers use [index.js](./index.js); sibling implementations do not import their own index.

## Key exports

- `assertSchemaVersion`: accepts supported integer schema versions and rejects all others.
- `parseStrictYaml`: parses canonical YAML while rejecting aliases, duplicate
  keys, and unsupported values.
- `stringifyCanonicalYaml`: serializes validated values using the repository's canonical YAML bytes.
