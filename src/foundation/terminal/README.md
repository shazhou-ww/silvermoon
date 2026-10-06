# terminal

Adapt stdout, stderr, TTY capability, and terminal line writes.

## Capability boundary

- Allowed dependencies: process primitives.
- Does not own: content decisions, TUI state, and repository I/O.
- Cross-module callers use [index.ts](./index.ts); sibling implementations do not import their own index.

## Key exports

- `terminalCapabilities`: returns explicit stdin and stdout TTY facts.
- `writeTerminalLine`: writes one normalized non-empty terminal line through an injected sink.
