# Source modules

Silvermoon uses cohesive modules with explicit, export-only `index.js` entrypoints.
The [package entry](./index.js) preserves the public API; Agent integrations keep
their separate package subpaths.

| Module | Responsibility |
| --- | --- |
| [cli](./cli/README.md) | Adapt arguments, input, output selection and exit codes |
| [application](./application/README.md) | Orchestrate use cases and observations |
| [idea](./idea/README.md) | Model lifecycle, queries and scaffold plans |
| [command](./command/README.md) | Run one ordered command-message stream |
| [events](./events/README.md) | Read and validate persistent segmented events |
| [project](./project/README.md) | Observe configuration, adoption and guidance |
| [repository](./repository/README.md) | Provide Git, snapshots, transactions and caches |
| [response](./response/README.md) | Project structured responses and instructions |
| [presentation](./presentation/README.md) | Render Markdown, JSON-facing output and TUI |
| [agents](./agents/README.md) | Adapt existing external Agent callers |

Within a directory, import concrete sibling files. Across directory boundaries,
use the destination's explicit `index.js`. Pure callers use dedicated rule
entrypoints rather than mixed runtime facades. TUI stays behind a lazy entrypoint.
See [maintenance conventions](../docs/maintaining.md) for checks and limitations.
