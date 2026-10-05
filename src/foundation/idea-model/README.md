# idea-model

Model idea identity, lifecycle state, world revisions, and status rules.

## Capability boundary

- Allowed dependencies: coordinates and language.
- Does not own: inventory I/O, event storage, and command orchestration.
- Cross-module callers use [index.js](./index.js); sibling implementations do not import their own index.

## Key exports

- `deriveIdeaState`: derives the lifecycle phase from explicit approval and acceptance facts.
- `validateIdeaStatus`: validates a complete v1 status value.
- `encodeUlid`: encodes explicit time and random bytes as an idea ULID.
- `parseIdeaStatus`: parses strict status content without reading files.
