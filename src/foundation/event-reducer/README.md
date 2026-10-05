# event-reducer

Plan authorized append changes from explicit event state and human-gate facts.

## Capability boundary

- Allowed dependencies: event-codec and idea-model.
- Does not own: storage reads, Git fetch, and repository writes.
- Cross-module callers use [index.js](./index.js); sibling implementations do not import their own index.

## Key exports

- `parseRequest`: converts one business request into the next canonical event.
- `planFullEventChange`: plans an append candidate and reduction result without I/O.
- `assertHumanGate`: checks explicit authorization and exact world revision facts.
- `assertIntroducedDecisions`: validates every newly introduced lifecycle decision.
