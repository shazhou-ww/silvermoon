# Business layer

Orchestrate checking, inventory queries, navigation, creation, replay, append,
migration, and Agent integration. Each top-level file owns one business entry
or one compatibility surface; [index.ts](./index.ts) exports the CLI-facing APIs.

`schema-migration.ts` is the runtime router from stable capability-manifest
migration IDs to their implementations. The version-specific migration keeps
its transactional logic in `migrate-v1-to-v2.ts`; entrypoints and embedding
hosts invoke it through the router rather than maintaining a second migration.

Business entries receive narrow function ports and may depend on shared business
observations or foundation indexes. They do not parse process arguments, choose
terminal output, or call another command implementation.

Reusable orchestration lives in [shared](./shared/README.md) only after at least
two business entries need it. Event revision and recovery are not business
entries; exceptional history is maintained by reviewing the complete events
folder.
