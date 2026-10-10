# Maintaining Silvermoon

This page is the entry point for repository contributors and package
maintainers.

## Development

Install the locked dependency graph:

```sh
pnpm install --frozen-lockfile
```

Silvermoon does not depend on its own published package. Run the current
checkout through the same device-level global boundary used by every project:

```sh
pnpm setup:dev
silvermoon list-ideas --audience agent
```

`setup:dev` builds the checkout, links it as the global npm package, and
registers the canonical skill from `skills/silvermoon` by link in a personal
discovery path. The repository remains free of a Silvermoon self-dependency and
repository-local skill copy. Re-run `pnpm build` after runtime source changes;
skill changes are visible immediately through the personal link. Use the
global `silvermoon` executable for repository idea and check commands, and
verify it resolves to this checkout rather than a published or different copy.

Use the smallest check that covers a change:

```sh
pnpm typecheck         # strict no-emit TypeScript validation
pnpm build             # clean reproducible JS, declarations and maps in dist/
pnpm check:sanity      # offline pure logic and lightweight contracts
pnpm check:pure        # JSDoc @pure constraints and functional-core imports
pnpm check:commit      # worktree tests plus staged metadata validation
pnpm lint:markdown     # Markdown lint (contract tests check links)
pnpm test              # complete unit/runtime and repository contracts
pnpm test:integration  # real filesystem and Git behavior
pnpm test:e2e          # packed and installed CLI behavior
pnpm check             # complete release-grade validation
pnpm check:release     # same complete release-grade validation
pnpm check:skills      # external discovery of the canonical packaged skill
```

## Validation tiers

| Scenario | Responsibility |
| --- | --- |
| Edit / Agent iteration | `check:sanity`: strict typecheck, clean build, CLI syntax, @pure checks, pure unit tests, schema and API contracts; add change-specific tests |
| Before commit | `check:commit`: sanity, local contracts and Markdown, skill consistency, Git/CLI smoke, whitespace, staged Silvermoon metadata |
| Ordinary CI | Triggered on pull request, daily scheduled run, or manual dispatch. Unconditional sanity then complete unit/runtime on Ubuntu/Windows/macOS, Node 22/24; complete contracts and integration, static checks and skill discovery |
| Before delivery / release | `check` or `check:release`: every release-grade gate including package contents, installed-package E2E and external discovery |
| After publication | The existing release workflow's `verify-npm-release.ts`: registry identity, integrity, provenance, README and CDN |

`test:unit` includes `test/runtime` so moving filesystem, Git and terminal
tests out of sanity does not remove matrix coverage. `check:quick` retains its
original syntax plus complete unit/runtime and contract meaning, not a new
sanity alias. No assertions are duplicated into a second suite. The sanity
worker guard rejects real child processes and network I/O; it does not block
the Node test runner from creating workers. Terminal integration stays in
runtime, outside sanity.

Each CI matrix job runs the actual `pnpm check:sanity` entrypoint before the
complete unit/runtime suite. Passing `test:unit` alone does not prove the
sanity I/O boundary: it intentionally permits runtime tests. Tests that call
real Git, even only to compare pure logic with Git's behavior, belong in
`test/runtime`, not `test/unit`. Keep their assertions and platform coverage
when splitting mixed-cost files; never disable the sanity guard to admit them.

### Functional boundaries and pure functions

The [source module index](../src/README.md) describes the physical boundaries.
Every source directory has a concise responsibility README and an `index.ts`
containing only explicit named exports. Keep assembly and initialization in
implementation files, never in an index.

Import concrete siblings within a directory. Across directory boundaries, use
the destination's public index, including dedicated rule/trace/TUI sub-entrypoints.
Do not import a directory's own index from its implementation files.
Pure callers must not load a mixed runtime facade, and the presentation facade
must not eagerly load TUI or the Copilot SDK.

### Localized what's next templates

Keep command-specific, user-visible `what's next` messages under
`src/foundation/report/templates/whats-next/`. Do not add paired English and
Chinese long-form strings to business orchestration. The template directory
has four distinct responsibilities:

- `contract.ts` defines stable kebab-case template IDs and typed dynamic
  parameters.
- `en-US/` and `zh-CN/` contain matching filenames, with one `@pure`
  default-exported logical template per file.
- Each locale's `index.ts` registers its complete catalog; `registry.ts`
  selects a catalog without owning wording.
- `renderers.ts` provides statically traceable locale routing for pure callers.

Every locale template file starts with this review metadata:

```ts
/**
 * @template primary-behind
 * @when repository.primaryRelation=behind
 * Used after observing primary when local HEAD is behind it.
 */
```

The `@template` value must equal the filename without `.ts`. The `@when`
expression must be machine-readable and identical in every locale; the
explanatory sentence uses the file's locale. These comments document entry
conditions only and never drive runtime routing.

Pass all dynamic values through the template's typed parameter object. A
template may format an already selected terminal scenario, but it must not
read external state, perform I/O, or choose the business route. Preserve
message structure and wording when extracting an existing template; make
copy changes separately so their behavior is reviewable.

Adding, renaming, or removing a template requires the same change in both
locale directories, both locale indexes, the typed contract, and the static
renderers used by pure callers. The catalog contract test enforces filename
symmetry, header identity, registration completeness, and unique IDs.
Agent-facing gate output renders `response.review.presentation` as one
explicit fenced Markdown template with a direct instruction to use it. Do not
emit the presentation object as prose or repeat its candidate metadata in
parallel sections.
Run the focused template unit and contract tests, `pnpm typecheck`, and
`pnpm check:pure`; run the relevant command integration tests whenever
callers or wording change.

Moving files also requires updating package-resource URLs, authenticated cache
source coordinates, source tools, declarations, strict package contents and tests.
Keep source-only maintenance tools out of installed facades and package
contents. A schema migration declared in `schema/capabilities.json` is
different: it must have a packaged executable and a runtime router
implementation, and both must remain covered by the strict package contract.

Keep public export assembly in `src/index.ts` and preserve the existing command
and Agent package entrypoints. Internal use cases receive narrow sets of function
ports; they must not call another command, import the public barrel, or depend
on CLI/presentation. Shared repository readiness belongs outside navigation.

Use JSDoc `@pure` on verified functions, retaining ordinary business names:

```js
/** @pure */
export function selectIdea(ideas, selector) {
  return ideas.find(({ id }) => id === selector) ?? null;
}
```

Pure functions do not mutate their inputs or shared state, access real I/O,
read implicit time/randomness/environment, or invoke unconfirmed effects.
Locally owned data may be mutated. Injecting a reader or callback does not make
a function pure. Keep `@pure` separate from bundler `@__PURE__` annotations.

`pnpm check:pure` uses the existing TypeScript AST and lexical symbols to check
annotations, rule-module dependencies, known external state, calls/callbacks,
and direct or borrowed-alias mutations. Reviewed external functions and
standard-library methods are explicitly listed in `bin/pure-check.ts`.
Do not add an entire package or arbitrary method to bypass a failure.
The checker also runs in sanity and release checks; contract tests check the
full source dependency graph and application boundaries.

This is a constraint checker, not a proof of arbitrary JavaScript purity:
dynamic object types, reflective access, runtime monkey-patching, third-party
internals and complex alias flows still require review. Pair it with the sanity
I/O guard, immutable-input tests and behavioral tests. The Markdown core takes
explicit time and local calendar facts; the public renderer alone reads the
default clock/timezone, preserving existing local-date behavior.

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
`node bin/ci-package-risk.ts --full` to inspect the full decision;
`workflow_dispatch` executes the full CI set, and local `check:release` always
executes package/E2E regardless of the diff.

The CI snapshot check requires full history and a named remote matching the
configured primary URL exactly. Its isolated runner normalizes `origin` to
`https://github.com/shazhou-ww/silvermoon.git` and fetches `main` before checking
the selected commit. A checkout action's default URL spelling or shallow
history is not sufficient event-history evidence. This setup does not change
the selected commit or the project's primary configuration.

`check:skills:discover` runs `npx skills add . --list` and can use the network;
`check:skills` delegates to that discovery check. Missing tools and failed
external checks are errors, not successful skips. No validation entrypoint
publishes npm.

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

Edit the canonical skill only under `skills/silvermoon`. `pnpm link:skill`
registers that directory by link in a personal discovery path, so no generated
repository copy can become stale.
The repository-only publish skill is maintained directly under
`.agents/skills/publish`; it is not part of the personal Silvermoon
registration or npm package.
For documentation and skill iteration, run `pnpm lint:markdown`,
relevant contract tests, and `pnpm check:skills` before skill delivery.

Run `pnpm check` before delivery of CLI, schema, repository model, release,
or skill changes, not after every edit.
Documentation work must also preserve Markdown links, package contents,
installed-package rendering surfaces, and `git diff --check`.

## GitHub Actions Dependencies

Every external action under `.github/workflows` is pinned to a full commit SHA
with its exact semantic version in an inline comment. Never replace a pin with
a movable major tag. Dependabot checks the `github-actions` ecosystem weekly
and proposes reviewable SHA/version updates; do not auto-merge those PRs.
Review the upstream release and action ownership, then require the complete CI
gate before merging.

The branch ruleset protects `main` against deletion and non-fast-forward
updates. Keep its configuration synchronized with `.github/rulesets/main.json`.

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
