# report

Project explicit terminal facts into four report projections, diagnostics, and localized next steps.

## Capability boundary

- Allowed dependencies: idea-model, coordinates, language, schema-capability
  types, and pure facts.
- Does not own: repository reads, action execution, and terminal rendering.
- Cross-module callers use [index.ts](./index.ts); sibling implementations do not import their own index.

## Key exports

- `projectCommandReport`: builds the four report projections from explicit final facts.
- `diagnosticProblem`: maps a diagnostic to a stable public problem.
- `respond`: selects a structured response without rendering it.
- `projectInstructions`: derives localized instructions from explicit project findings.
- `templates/whats-next/`: owns typed, locale-symmetric `what's next`
  message templates; follow the
  [template conventions](../../../docs/maintaining.md#localized-whats-next-templates).
- Observations and responses preserve complete per-file schema readiness;
  renderers suppress current files.
