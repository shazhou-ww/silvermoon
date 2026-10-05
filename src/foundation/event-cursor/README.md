# event-cursor

Validate one exact event prefix and return only its suffix.

## Capability boundary

- Allowed dependencies: event-store and event-history.
- Does not own: automatic cursor reset and substitution for full replay.
- Cross-module callers use [index.js](./index.js); sibling implementations do not import their own index.

## Key exports

- `readEventDelta`: returns a suffix only when length and digest bind the exact prefix.
