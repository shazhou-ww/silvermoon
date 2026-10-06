# git

Execute Git commands and expose refs, objects, commit relations, and explicit fetch operations.

## Capability boundary

- Allowed dependencies: process and trace.
- Does not own: snapshot selection, lifecycle policy, and implicit network access.
- Cross-module callers use [index.ts](./index.ts); sibling implementations do
  not import their own index.

## Key exports

- `runGit`: runs one Git command and returns explicit stdout, stderr, and status facts.
- `fetchPrimary`: fetches the configured primary branch when the caller
  explicitly requests network access.
- `compareCommits`: compares two commits without deciding business readiness.
- `inspectRepositoryState`: reads branch, HEAD, upstream, and worktree repository facts.
- `openDerivedCache`: opens the authenticated low-level cache used by exact Git
  source snapshots.
