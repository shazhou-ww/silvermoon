# scaffold-plan

Convert explicit identity, time, language, and template facts into a ScaffoldPlan.

## Capability boundary

- Allowed dependencies: coordinates, idea-model, idea-template, and event-codec.
- Does not own: default value acquisition and filesystem writes.
- Cross-module callers use [index.ts](./index.ts); sibling implementations do not import their own index.

## Key exports

- `buildIdeaScaffold`: builds the complete deterministic directory and file byte plan.
