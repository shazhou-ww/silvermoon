# Shared business observations

Provide the explicit `observeProject` to project-schema inspection to
`observeDevice` to `observeIdea` observation chain and repository readiness
shared by multiple business entries.
[index.ts](./index.ts) lists the supported shared surface.

- `observeDevice` reports runtime source, global installation, and global config.
- `observeProject` reports repository, configuration, and snapshot facts.
- `observeSnapshot` classifies every schema-bearing project file before an
  older layout adapter can interpret future metadata.
- `observeIdea` consumes project facts and reports selected idea/world facts.
- readiness functions acquire repository facts but keep pure policy separate.

The layer keeps commit, tree, and content provenance explicit. It does not render
UI, record human decisions, hide fetches, or probe daemon state.
