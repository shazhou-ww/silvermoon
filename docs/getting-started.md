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

The setup report gives the exact path for the running installation. Use it to
register the bundled canonical skill through the universal `skills` target:

```sh
npx skills add <path-to-running-silvermoon>/skills --skill silvermoon --agent universal --yes --copy
```

The registration lives only at `.agents/skills/silvermoon`. Silvermoon checks
that its content exactly matches the running installation. It does not require
the target repository to use Node, contain `package.json`, declare a
Silvermoon dependency, or have `node_modules`, and it never mutates skill
registration itself.

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

## Configure Preferred Language

All language values are canonical BCP 47 tags such as `en` or `zh-CN`.
Silvermoon resolves natural-language output in this order:

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
The shared observation reports the resolved non-empty language tag.

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
`status.yaml`. It never stages, commits, pushes, or records a human decision.

Replace the guidance in the `Idea.md` ideal contract with the desired outcome,
scope, and constraints. Keep the `Implementation.md` inner implementation
contract and `Deployment.md` real-world deployment contract placeholders
synchronized until their lifecycle phases. Review every generated path and
publish the prepared idea through ordinary Git.

Then ask what comes next with the generated ULID or an exact unique alias:

```sh
silvermoon whats-next <idea>
```

The default dialogue uses lightweight Markdown headings for intent,
observation, and ordered next instructions; actions and outcomes appear only
when an operation was attempted. Add `--json` only when a programmatic
consumer needs the `intention / observation / outcomes / instructions`
envelope. Execute the applicable instructions in order and run the same
command again only after an expected repository change, an unexpected input
change, or a newly arrived external result.

## Make Decisions Explicit

Silvermoon never infers approval or acceptance. After a person explicitly
approves the current ideal, accepts the current implementation, or accepts the
current deployment, record the exact revision reported by `whats-next` in the
corresponding `status.yaml` field. Validate the full candidate with
`silvermoon check --worktree`, stage it, then run `silvermoon check --staged`
to validate the index before publishing a normal non-force commit. Default
`check` validates committed `HEAD`, not the pending commit; only a successful
project validation exits `0`.

Continue with [Core Concepts](./core-concepts.md) before changing lifecycle
contracts, or use [Operating Silvermoon](./operations.md) for the routine
navigation and publication loop.

## Adopt Silvermoon In An Existing Repository

Adoption is a direct breaking cutover. Silvermoon recognizes only
`.silvermoon/config.yaml` version 1 and does not read, convert, or diagnose
previous layouts. Preserve Git history and record only decision facts supported
by explicit review. Follow the canonical installed skill's
`references/adoption.md` for the full adoption sequence.
