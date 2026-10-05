# idea-query

Filter, sort, limit, and project explicit idea inventory facts.

## Capability boundary

- Allowed dependencies: idea-model.
- Does not own: directory reads, networking, and lifecycle changes.
- Cross-module callers use [index.js](./index.js); sibling implementations do not import their own index.

## Key exports

- `normalizeIdeaQuery`: normalizes public query options while preserving compatibility.
- `queryIdeaInventory`: queries an explicit inventory using public defaults.
- `queryIdeaInventoryCore`: executes the pure query against explicit enumeration facts.
- `extractIdeaTitle`: extracts a display title from explicit contract content.
