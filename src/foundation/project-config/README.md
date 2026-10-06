# project-config

Read and strictly parse one project configuration and its provenance.

## Capability boundary

- Allowed dependencies: coordinates, language, schema, and git.
- Does not own: adoption policy, guidance, user configuration, and readiness.
- Cross-module callers use [index.ts](./index.ts); sibling implementations do not import their own index.

## Key exports

- `loadConfig`: reads the worktree project configuration.
- `loadConfigSnapshot`: reads configuration from one exact Git snapshot.
- `parseConfigSource`: validates strict configuration content without I/O.
- `serializeConfig`: serializes validated project configuration canonically.
