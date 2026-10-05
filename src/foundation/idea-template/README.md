# idea-template

Generate canonical world and ledger document content for an explicit language and version.

## Capability boundary

- Allowed dependencies: language.
- Does not own: ID or time generation and filesystem writes.
- Cross-module callers use [index.js](./index.js); sibling implementations do not import their own index.

## Key exports

- `ideaTemplates`: returns the canonical scaffold templates for explicit language and version facts.
