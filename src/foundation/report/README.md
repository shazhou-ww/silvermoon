# report

Project explicit terminal facts into four report projections, diagnostics, and localized next steps.

## Capability boundary

- Allowed dependencies: idea-model, coordinates, language, and pure facts.
- Does not own: repository reads, action execution, and terminal rendering.
- Cross-module callers use [index.js](./index.js); sibling implementations do not import their own index.

## Key exports

- `projectCommandReport`: builds the four report projections from explicit final facts.
- `diagnosticProblem`: maps a diagnostic to a stable public problem.
- `respond`: selects a structured response without rendering it.
- `projectInstructions`: derives localized instructions from explicit project findings.
