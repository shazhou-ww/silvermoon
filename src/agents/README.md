# Agent adapters

Provide the existing Copilot adapter, local project registry and project runtime.
The project-owned CLI remains the lifecycle and event authority.

[index.js](./index.js) exposes the module API. The package retains independent
Copilot and project-runtime subpaths and their type declarations; the root API
does not load the Copilot SDK.

Use sibling implementations internally and protocol rule entrypoints externally.
Delivery/activity observations do not imply processing, approval or completion.
