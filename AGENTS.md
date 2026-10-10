# Silvermoon repository instructions

## Development runtime and skill

- This repository develops Silvermoon itself and must not depend on the
  published `silvermoon` package in any dependency section.
- Run `pnpm setup:dev` to build this checkout, link it as the device-level
  global `silvermoon` runtime, and register its canonical skill by link in a
  personal discovery path.
- Run every Silvermoon command through that global `silvermoon` executable.
  It must resolve to this checkout; never use a published copy, another
  checkout, `npx silvermoon`, a project dependency, or a direct `node bin/...`
  entrypoint.
- Maintain the one canonical skill in `skills/silvermoon`. Do not create or
  synchronize a repository-local skill copy; the personal registration links
  directly to the canonical directory.

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
- Before Idea acceptance, replace the Implementation and Deployment scaffold
  placeholders with lightweight first versions of at most three high-level
  steps and three observable criteria each, mirrored unchecked in `ledger.md`.
  These seeds remain outside the `acceptIdeal` decision scope.
- Before a human gate, synchronize the candidate to primary, reobserve its
  exact revision and content language, then provide a short review index in
  ordinary assistant Markdown with local and commit-pinned remote links to
  substantive repository artifacts. Keep full object IDs internally but show
  only 12-character revision and primary references. Use the canonical compact
  gate format: identity and references, one-sentence focus, links, then one
  exact candidate question. Complete that index as its own assistant turn; never open an
  interactive decision in the same turn because its tool surface may hide the
  links. Use a later interactive decision only for the exact question and
  choices; do not put local file links in its prompt or repeat gate-policy
  narration when the user is unavailable.
- Requery only after an observable change. Yield on human or external waits;
  stop on actionable errors or lack of progress.

## Validation

- Iterate with `pnpm check:sanity` plus change-specific tests; use
  `pnpm check:commit` before committing. Its tests use the worktree;
  `silvermoon check --staged` checks metadata, not staged-code test results.
- Run `pnpm check` (alias `check:release`) before delivery of CLI, schema,
  repository model, release, or skill changes; it remains full release-grade.
- Run `pnpm check:skills` before delivering skill frontmatter or structure
  changes.
- Do not commit secrets, credentials, tokens, or private customer data.

## npm releases

- Follow [`docs/npm-package-releases.md`](docs/npm-package-releases.md).
- Publish only through `.github/workflows/publish-npm.yml`, using an immutable
  `npm/silvermoon/v<version>` tag on a commit reachable from `origin/main`.
  Never publish locally or add npm tokens.
