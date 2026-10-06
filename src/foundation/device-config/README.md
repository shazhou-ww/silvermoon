# device-config

Locate, read, and strictly parse the global Silvermoon configuration.

## Capability boundary

- Allowed dependencies: language and project-config YAML primitives.
- Does not own: project configuration, configuration writes, and daemon state.
- Cross-module callers use [index.ts](./index.ts); sibling implementations do not import their own index.

## Key exports

- `loadUserConfig`: returns global configuration, its path, and explicit diagnostics.
- `serializeUserConfig`: serializes a validated global configuration canonically.
