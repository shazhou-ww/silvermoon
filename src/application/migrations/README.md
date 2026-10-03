# Explicit migrations

Provide the existing authorized v1-to-v2 migration through [index.js](./index.js).
Source-only legacy/segmentation repair tools remain separate and are excluded
from the installed npm package.

Use project, observation, event and repository entrypoints. Preserve exact source
bytes, primary checks, explicit recovery and migration authorization.

Ordinary reads and module reorganization never authorize a repository migration.
