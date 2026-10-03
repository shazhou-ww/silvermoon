# Presentation adapters

Preserve public Markdown rendering and default clock/local-calendar behavior
through [index.js](./index.js). [Rules](./rules/README.md) render from explicit facts.

Structured business responses come from the response module, not this renderer.
The [TUI](./tui/README.md) has a separate lazily imported entrypoint.

Do not re-derive lifecycle state, perform repository work or eagerly export TUI
implementations from the parent facade.
