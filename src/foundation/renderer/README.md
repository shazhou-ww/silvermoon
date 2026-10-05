# renderer

Purely render explicit reports and time facts as JSON, Text, or Markdown.

## Capability boundary

- Allowed dependencies: language and report.
- Does not own: clock reads, lifecycle derivation, and terminal I/O.
- Cross-module callers use [index.js](./index.js); sibling implementations do not import their own index.

## Key exports

- `renderResponse`: renders the public response using the compatibility default clock wrapper.
- `renderResponseAt`: renders with an explicit clock for pure tests.
- `renderMarkdownResponse`: renders deterministic agent Markdown.
