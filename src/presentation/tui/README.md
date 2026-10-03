# Terminal UI

Render the existing interactive document/table view and terminal interactions.
[index.js](./index.js) is the explicit lazy TUI entrypoint.

Use sibling table/UI implementations and trace capabilities. Preserve keyboard,
clipboard, Unicode, terminal-width and failure behavior.

Only import this entrypoint after TUI selection; it does not own business rules.
