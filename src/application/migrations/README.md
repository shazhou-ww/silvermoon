# Explicit migrations

Provide the existing authorized v1-to-v2 migration through [index.js](./index.js).

Use project, observation, event and repository entrypoints. Preserve exact source
bytes, primary checks, explicit recovery and migration authorization.

Ordinary reads and module reorganization never authorize a repository migration.
Completed source-checkout format conversions are not retained as applications.
