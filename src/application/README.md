# Application use cases

Orchestrate checking, inventory queries, navigation, creation and event commands.
Use cases receive narrow function ports; [index.js](./index.js) exports their APIs.
No command calls another command or depends on CLI/presentation.

Shared work lives in [observation](./observation/README.md),
[event orchestration](./events/README.md), [readiness rules](./rules/README.md),
[scaffold writes](./scaffold/README.md) and [migrations](./migrations/README.md).

Keep command-specific fetch, snapshot, exit/report and recovery semantics distinct.
This module does not infer human decisions or publish npm packages.
