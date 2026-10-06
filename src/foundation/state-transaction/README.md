# state-transaction

Recheck and atomically apply exact before and after bytes under a project lock.

## Capability boundary

- Allowed dependencies: filesystem primitives and coordinates.
- Does not own: business authorization, revise or recover commands, and silent retry.
- Cross-module callers use [index.ts](./index.ts); sibling implementations do not import their own index.

## Key exports

- `stateTransaction`: applies a guarded state write with before, after, and validation hooks.
- `recoverStateTransaction`: supports only retained explicit migration compatibility recovery.
- `stateBytes`: reads exact transaction-controlled state bytes.
