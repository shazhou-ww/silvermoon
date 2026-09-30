# Maintaining Silvermoon

This page is the entry point for repository contributors and package
maintainers.

## Development

Install the locked dependency graph:

```sh
pnpm install --frozen-lockfile
```

Use the smallest check that covers a change:

```sh
pnpm sync:skills       # refresh the generated universal skill copy
pnpm check:sanity      # offline pure logic and lightweight contracts
pnpm check:commit      # worktree tests plus staged metadata validation
pnpm lint:markdown     # Markdown lint (contract tests check links)
pnpm test              # complete unit/runtime and repository contracts
pnpm test:integration  # real filesystem and Git behavior
pnpm test:e2e          # packed and installed CLI behavior
pnpm check             # complete release-grade validation
pnpm check:release     # same complete release-grade validation
pnpm check:skills:local # local skill copy consistency, no discovery
pnpm check:skills      # local consistency and external skill discovery
```

## Validation tiers

| Scenario | Responsibility |
| --- | --- |
| Edit / Agent iteration | `check:sanity`: CLI syntax, pure unit tests, schema and API contracts; add change-specific tests |
| Before commit | `check:commit`: sanity, local contracts and Markdown, skill consistency, Git/CLI smoke, whitespace, staged Silvermoon metadata |
| Ordinary CI | Unconditional unit/runtime on Ubuntu/Windows/macOS, Node 22/24; complete contracts and integration, static checks and skill discovery |
| Before delivery / release | `check` or `check:release`: every release-grade gate including package contents, installed-package E2E and external discovery |
| After publication | The existing release workflow's `verify-npm-release.mjs`: registry identity, integrity, provenance, README and CDN |

`test:unit` includes `test/runtime` so moving filesystem, Git and terminal
tests out of sanity does not remove matrix coverage. `check:quick` retains its
original syntax plus complete unit/runtime and contract meaning, not a new
sanity alias. No assertions are duplicated into a second suite. The sanity
worker guard rejects real child processes and network I/O; it does not block
the Node test runner from creating workers. Terminal integration stays in
runtime, outside sanity.

`check:commit` always prints its scope: tests validate the **worktree**, while
`silvermoon check --staged` validates **staged Silvermoon metadata only**.
With partial staging these are different candidates; a passing command does
not prove staged code passed the tests. Align index and worktree and rerun
before claiming exact-candidate evidence. The command never stages, stashes,
installs a hook or changes Git configuration.

CI adds package contents and installed-package E2E unless every changed path
is known idea metadata under `.silvermoon/ideas/<ULID>/`. Everything else,
including shipped docs, dependencies/locks, CLI entries, skills, tests,
scripts, workflows and unknown paths, requires package validation. The
selector uses the full base/head diff and both endpoints of renames; missing
history, malformed or empty changes conservatively require validation with
an explicit reason. Core jobs never use path filtering. Run
`node scripts/ci-package-risk.mjs --full` to inspect the full decision;
`workflow_dispatch` executes the full CI set, and local `check:release` always
executes package/E2E regardless of the diff.

`check:skills:local` needs no external discovery tool.
`check:skills:discover` runs `npx skills add . --list` and can use the network;
`check:skills` runs both in order. Missing tools and failed external checks
are errors, not successful skips. No validation entrypoint publishes npm.

`pnpm check` runs the independent release-grade checks concurrently and waits
for all of them before reporting every failure. Run the narrower commands above
while iterating, then use `pnpm check` before delivery.

Each full check reports `CHECK_DURATION` for every gate and `CHECK_TOTAL` for
the complete run. These values use a monotonic clock and are diagnostic, not
machine-independent budgets. To compare performance, record the Node.js and
pnpm versions and test counts, run `pnpm check` once to warm the checkout, then
repeat it five times and compare the median under the same machine and checkout
conditions. Keep each sample; do not count network, queueing, or cache
fluctuations in installed-package smoke tests as code performance gains.

Edit the canonical skill only under `skills/silvermoon`, then run
`pnpm sync:skills`. The checked-in `.agents/skills/silvermoon` directory is a
generated copy so repository skill discovery works without symbolic-link
support. `pnpm check:skills` rejects a stale or manually edited copy.
The repository-only publish skill is maintained directly under
`.agents/skills/publish`; it is not part of the generated copy or npm package.
For documentation and skill iteration, run `pnpm lint:markdown`,
`pnpm check:skills:local`, and relevant contract tests; run external
`pnpm check:skills` before skill delivery.

Run `pnpm check` before delivery of CLI, schema, repository model, release,
or skill changes, not after every edit.
Documentation work must also preserve Markdown links, package contents,
installed-package rendering surfaces, and `git diff --check`.

## Documentation Ownership

- [Getting Started](./getting-started.md) owns installation, configuration,
  first use, and adoption entry.
- [Core Concepts](./core-concepts.md) owns product reasoning, nested worlds,
  decision boundaries, and continuity.
- [Operating Silvermoon](./operations.md) owns the routine Agent and Git loop.
- [Technical Reference](./reference.md) owns exact storage, revision, state,
  command-report, validation, and schema details.
- The English and Chinese READMEs remain synchronized reader-first entrances;
  they link to these authoritative pages instead of duplicating full
  specifications.

## Repository Work And Releases

Use [Repository idea workflow](./repository-tasks.md) for this repository's
Silvermoon coordination rules.

Use [npm package releases](./npm-package-releases.md) for trusted publishing,
tag rules, release validation, and failure recovery. Publishing occurs only
through `.github/workflows/publish-npm.yml` from an immutable
`npm/silvermoon/v<version>` tag whose commit is reachable from `origin/main`.
The workflow generates both package READMEs in an isolated staging tree,
validates and publishes one tarball, then checks its registry integrity,
package-level README, provenance, and commit-pinned jsDelivr assets. Never
publish locally or add an npm token.
