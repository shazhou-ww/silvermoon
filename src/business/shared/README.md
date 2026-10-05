# Shared business observations

Provide the explicit `observeDevice` to `observeProject` to `observeIdea`
observation chain and repository readiness shared by multiple business entries.
[index.js](./index.js) lists the supported shared surface.

- `observeDevice` reports runtime source, global installation, and global config.
- `observeProject` consumes device facts and reports project/config/snapshot facts.
- `observeIdea` consumes project facts and reports selected idea/world facts.
- readiness functions acquire repository facts but keep pure policy separate.

The layer keeps commit, tree, and content provenance explicit. It does not render
UI, record human decisions, hide fetches, or probe daemon state.
