# Getting Started

This guide is the authoritative setup and first-use path for Silvermoon.

## Prerequisites

- Node.js 22 or newer.
- A Git repository whose shared primary branch is reachable over HTTPS.
- Permission to fetch that branch and to publish ordinary non-force commits
  through the repository's normal collaboration path.

## Run Silvermoon And Register Its Skill

Install Silvermoon independently of the target project's dependency graph, or
invoke a chosen version temporarily:

```sh
npm install --global silvermoon
silvermoon whats-next
# or: npx silvermoon@<version> whats-next
```

For repositories without a root `package.json`, the setup report gives the
exact path for the running installation. Use it to register the bundled
canonical skill through the universal `skills` target:

```sh
npx skills add <path-to-running-silvermoon>/skills --skill silvermoon --agent universal --yes --copy
```

If the repository root contains `package.json`, Silvermoon requires valid JSON
and an exact `devDependencies.silvermoon` value of `^<running-version>`.
Follow all commands in the setup report in order; then register the
project-local canonical skill:

```sh
npx skills add ./node_modules/silvermoon/skills --skill silvermoon --agent universal --yes --copy
```

Only the tracked root manifest is part of readiness; installed dependencies
and `node_modules` are not required for snapshot checks. Silvermoon checks the
registration at `.agents/skills/silvermoon` against its running canonical
skill, and never mutates the manifest, package-manager files, dependencies, or
skill registration itself. Non-npm repositories remain free of npm setup.

## Configure The Shared Primary

Create `.silvermoon/config.yaml`:

```yaml
version: 1
primaryRepository: https://github.com/example/repository.git
primaryBranch: main
preferredLanguage: en
```

The repository URL is credential-free, canonical shared state. Credentials,
named remotes, and URL rewrites remain local Git concerns. Silvermoon metadata
paths are fixed and cannot be overridden by configuration.

## Add Optional Project Phase Guidance

Projects with additional lifecycle requirements may add any of these fixed
files:

```text
.silvermoon/guidance/
|-- preparing.md
|-- implementing.md
`-- deploying.md
```

Each file is optional, repository-owned Markdown for only its named phase.
`whats-next <idea>` returns the applicable file only after that actionable
phase becomes the highest-priority next action. A successful `create-idea`
returns only preparing guidance after local preflight and before relying on
the new scaffold. `observation.guidance` includes the fixed path and exact Git
blob `contentRevision`; `response.guidance` carries that provenance plus the
captured content, so consumers must not reread the file.

Keep each file at most 32 KiB of valid UTF-8 without a BOM or NUL byte, with at
least one non-whitespace character. Use regular files and no extra entries in
the directory. Lifecycle commands validate only the phase they are about to
return; every `check` target validates the complete directory.

Guidance is additive and lower priority than Silvermoon's canonical workflow.
Put every applicable idea-specific requirement into the current world contract
and matching ledger entries. The guidance itself is not a fourth contract,
approval, acceptance, status fact, or completion evidence.

## Configure Content And Output Language

All language values are canonical BCP 47 tags such as `en` or `zh-CN`.
Silvermoon resolves the language for project-owned content in this order:

1. optional idea `status.yaml` `language`;
2. optional project `.silvermoon/config.yaml` `preferredLanguage`;
3. optional user `~/.config/silvermoon/config.yaml` `preferredLanguage`;
4. `en-US`.

The user configuration is outside the repository:

```yaml
version: 1
preferredLanguage: zh-CN
```

Inherited values remain dynamic and are not copied into an idea. Use
`create-idea --language <tag>` only when the new idea needs a stable override.
That command continues to accept any canonical BCP 47 tag.

For one invocation's Silvermoon-owned output, `whats-next` and `check` accept
only the built-in `en-US` and `zh-CN` locales. Input casing is normalized, so
`EN-us` and `zh-cn` are accepted. This override has higher display precedence
than idea, project, or user content language and is never persisted:

```sh
silvermoon whats-next <idea> --language zh-CN
silvermoon check --worktree --language en-US
```

Every observation reports the actual built-in locale as `outputLanguage`.
When configuration is available, `configuration.preferredLanguage` remains
the resolved content language and can therefore differ from `outputLanguage`.
Without a temporary override, Chinese content tags use `zh-CN` output and all
other content tags use the built-in `en-US` output.

The resolved content language applies to natural-language content throughout
`Idea.md`, `Implementation.md`, `Deployment.md`, same-world supporting files,
and `ledger.md`. Canonical headings, stable IDs, paths, CLI options, and schema
fields are machine contracts and remain unchanged. `create-idea` localizes
built-in English and Chinese scaffolds; for another canonical language tag its
next step names the fallback template language and requires the Agent to
replace every natural-language placeholder before continuing.

## Inspect The Local Idea Inventory

Use the dedicated read-only query when the question is which ideas exist,
rather than what lifecycle action comes next:

```sh
silvermoon list-ideas
silvermoon list-ideas --state implementing --state deploying
silvermoon list-ideas --all --query release --sort oldest --limit 20
silvermoon list-ideas \
  --created-since 2026-09-01T00:00:00Z \
  --created-before 2026-10-01T00:00:00Z
```

The default set is `preparing`, `implementing`, and `deploying`. Repeated state
values form a deduplicated union, while text and time filters intersect with
that set. `active` expands to the default three states; `--all` selects all
five lifecycle states and cannot be combined with `--state`. Sorting is
newest-first unless `--sort oldest` is given, and `--limit` is applied only
after filtering and stable sorting.

`list-ideas` validates Git presence, project configuration, the canonical
skill, and the complete idea layout, then reads the current worktree snapshot.
It does not inspect cleanliness, branch, upstream, or ancestry and never
fetches or contacts the configured primary. Staged, unstaged, and untracked
idea changes are therefore visible when they form a valid snapshot. Invalid
query arguments fail with exit `2` before repository or trace access; an
untrusted project or layout exits `1` instead of returning a partial list.
The command has no temporary `--language` option and uses the project's
resolved output language.

## Create The First Idea

Run:

```sh
silvermoon create-idea
silvermoon create-idea --language zh-cn
```

The command requires the configured primary branch and upstream plus a clean
local worktree. It does not fetch or require local HEAD to match the remote
tip. When those checks pass, it creates one untracked idea scaffold with
`Idea.md`, `Implementation.md`, `Deployment.md`, `ledger.md`, and
`status.yaml`. If valid preparing guidance exists, the success report includes
its snapshot-bound content. Invalid preparing guidance stops before any
scaffold path is written. The command never stages, commits, pushes, or records
a human decision.

Replace the guidance in the `Idea.md` ideal contract with the desired outcome,
scope, and constraints. Keep the `Implementation.md` inner implementation
contract and `Deployment.md` real-world deployment contract placeholders
synchronized until their lifecycle phases. Review every generated path,
validate the complete candidate, and commit and publish the prepared idea to
the configured primary through the repository's normal non-force publication
path. Verify it is reachable from refreshed primary before asking the user to
review or approve the exact reported ideal revision. If publication requires a
pull request, wait until it reaches primary; never ask for approval of an
unpublished local candidate. Publication does not itself approve the idea.

Then ask what comes next with the generated ULID or an exact unique alias:

```sh
silvermoon whats-next <idea>
```

Default Markdown renders only the self-contained response. Add `--json` when a
programmatic consumer needs the complete
`intention / observation / actions / response` report. Read every problem and
execute applicable `response.nextSteps` in order; `actions` contains only
side effects Silvermoon already attempted. Run the same command again only
after an expected repository change, an unexpected input change, or a newly
arrived external result.

## Make Decisions Explicit

Silvermoon never infers approval or acceptance. After a person explicitly
approves the current ideal, accepts the current implementation, or accepts the
current deployment, record the exact revision reported by `whats-next` in the
corresponding `status.yaml` field. Validate the full candidate with
`silvermoon check --worktree`, stage it, then run `silvermoon check --staged`
to validate the index before publishing a normal non-force commit. Default
`check` validates committed `HEAD`, not the pending commit; only a successful
project validation exits `0`.

When requesting any approval or acceptance, include the idea's alias and ULID,
the decision and exact world revision, plus a clickable permalink to the
canonical world entry pinned to the published primary commit. Link to
`Idea.md`, `Implementation.md`, or `Deployment.md` as appropriate. Do not use
a local workspace path or a branch-floating link; if the host has no known
permalink format, provide the primary commit and repository-relative path and
explain the limitation.

Continue with [Core Concepts](./core-concepts.md) before changing lifecycle
contracts, or use [Operating Silvermoon](./operations.md) for the routine
navigation and publication loop.

## Adopt Silvermoon In An Existing Repository

Adoption is a direct breaking cutover. Silvermoon recognizes only
`.silvermoon/config.yaml` version 1 and does not read, convert, or diagnose
previous layouts. Preserve Git history and record only decision facts supported
by explicit review. Follow the canonical installed skill's
`references/adoption.md` for the full adoption sequence.
