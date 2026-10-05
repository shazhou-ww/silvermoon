# tui

Lazily run the interactive terminal interface and return explicit user choices.

## Capability boundary

- Allowed dependencies: renderer and terminal.
- Does not own: eager parent loading, business derivation, and repository I/O.
- Cross-module callers use [index.js](./index.js); sibling implementations do not import their own index.

## Key exports

- `renderTuiMarkdown`: renders Markdown in the lazily loaded interactive terminal.
- `markdownTable`: converts explicit Markdown table facts for TUI display.
