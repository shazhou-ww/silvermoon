# snapshot

Read immutable worktree, index, commit, or remote snapshot content.

## Capability boundary

- Allowed dependencies: git.
- Does not own: fetch, lifecycle decisions, and repository writes.
- Cross-module callers use [index.ts](./index.ts); sibling implementations do not import their own index.

## Key exports

- `createGitSnapshotFileSystem`: creates a read-only filesystem bound to one exact Git tree.
