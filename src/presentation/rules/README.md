# Markdown rendering rules

Render responses, tables, escaping and relative/absolute dates from explicit
time and calendar facts. [index.js](./index.js) exports the pure Markdown core.

Use project localization rules only; do not read the clock, timezone or terminal.
Preserve the existing display shape and error behavior.

Default environmental facts and output publication belong to adapters.
