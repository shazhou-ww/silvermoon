# Silvermoon repository instructions

## Idea workflow

- Handle small, well-scoped tasks directly. For substantial, multi-step work
  that needs durable scope, decisions, or progress tracking, suggest an idea
  and wait for confirmation before creating it.
- Load [`silvermoon`](skills/silvermoon/SKILL.md) and apply
  [`docs/repository-tasks.md`](docs/repository-tasks.md) only when the user
  invokes `/silvermoon`, requests a new idea, or asks to navigate or continue
  an existing one.
- Start new ideas with `silvermoon create-idea --audience agent`; otherwise
  start with `silvermoon whats-next [idea] --audience agent`. Use `--json`
  instead only for programmatic four-projection consumption. Execute only the
  highest-priority action and preserve invocation options and creation intent
  across hygiene retries.
- Preserve unknown and concurrent work. Never force-push, reset, clean, or
  silently replay a stale decision.
- Record approval, acceptance, and abandonment only as explicit status facts,
  validate the exact candidate, and synchronize through ordinary non-force Git.
- Before a human gate, synchronize the candidate to primary, reobserve its
  exact revision and content language, then provide a short review index in
  ordinary assistant Markdown with local and commit-pinned remote links to
  durable repository artifacts. Use an interactive decision tool only for the
  exact question and choices; do not put local file links in its prompt.
- Requery only after an observable change. Yield on human or external waits;
  stop on actionable errors or lack of progress.

## Validation

- Iterate with `pnpm check:sanity` plus change-specific tests; use
  `pnpm check:commit` before committing. Its tests use the worktree;
  `silvermoon check --staged` checks metadata, not staged-code test results.
- Run `pnpm check` (alias `check:release`) before delivery of CLI, schema,
  repository model, release, or skill changes; it remains full release-grade.
- Run `pnpm check:skills:local` while editing skills and `pnpm check:skills`
  before delivering skill frontmatter or structure changes.
- Do not commit secrets, credentials, tokens, or private customer data.

## npm releases

- Follow [`docs/npm-package-releases.md`](docs/npm-package-releases.md).
- Publish only through `.github/workflows/publish-npm.yml`, using an immutable
  `npm/silvermoon/v<version>` tag on a commit reachable from `origin/main`.
  Never publish locally or add npm tokens.
