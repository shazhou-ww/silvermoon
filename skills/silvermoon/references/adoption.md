# Silvermoon adoption

## New repositories

Start with a complete diagnosis, even in an unfamiliar repository:

```sh
silvermoon whats-next
```

Default output renders only the self-contained response. Add `--json` only
when a programmatic consumer needs the complete
`intention / observation / actions / response` report (including
`actions: []` when no side effect was attempted).
The command may fetch after local readiness passes, but it does not move the
worktree, index, branches, or named refs.

Install one Silvermoon runtime for the device or Agent host, independently of
every target repository:

```sh
npm install --global silvermoon
```

Register that installation's canonical skill in the universal personal
discovery path:

```sh
silvermoon-link-skill
```

The command creates `~/.agents/skills/silvermoon` as a link and refuses to
overwrite a modified or mismatched registration.

The target repository may use any language or build ecosystem. Silvermoon does
not read or modify its `package.json`, dependency graph, `node_modules`, or
repository skill paths. Project readiness depends only on Git, Silvermoon
configuration, metadata schema, and layout. Runtime identity, latest-version
checks, and personal skill registration belong to device readiness.

Read a dialogue report's device advisory separately from its project
observation. A global runtime reuses a successful npm `latest` result for less
than 24 hours and validates personal discovery links against the running
package. Missing, broken, or stale links and registry failures require device
repair but do not turn a valid project snapshot into
`project-setup-required`. Snapshot-only `check` commands do not perform these
device checks.

Project observations report every discovered schema-bearing file under
`observation.schemas`. Validity and current-target readiness are independent:
a valid v1 file is readable but requires migration before `whats-next` or a
write workflow continues. `list-ideas` and snapshot-only `check` may read valid
historical metadata. A future version is never parsed or modified; project
preparation bypasses the 24-hour latest-runtime cache once and reports the
runtime freshness outcome.

Silvermoon's own source repository must not depend on its published package,
but it uses the same device boundary. Run `pnpm setup:dev` to build and link
the checkout as the global runtime and register its canonical skill by link in
a personal discovery path. Then use the ordinary `silvermoon` commands below.
The links expose unpublished changes without a repository-local skill copy.

Existing v1 projects remain readable and snapshot-valid, but lifecycle
preparation requires the declared `project-v1-to-v2` migration. New projects
use `version: 2` with the
[event storage and command rules](./events.md); create the canonical
`events.jsonl` file rather than status YAML and configure a named-primary
tracking ref before checking. Never convert an existing project by editing
only its version. Plan the declared edge from the installed runtime with
`silvermoon-migrate-v1-to-v2 --root <project>`; review its digest before
applying it as described in the event contract.

The compatible version 1 configuration is:

```yaml
version: 1
primaryRepository: https://example.com/owner/repository.git
primaryBranch: main
```

The URL is credential-free canonical HTTPS shared state; local Git credentials
and URL rewrites remain machine-local. Metadata and idea paths are fixed.

Commit the configuration, then run:

```sh
silvermoon check --commit HEAD
silvermoon check --remote
silvermoon create-idea
silvermoon whats-next <ULID>
```

`check` validates the selected project snapshot (and v2 primary event history);
it does not navigate
ideas or check worktree hygiene and upstream. Default `check` validates
committed `HEAD`, whereas `check --staged` validates the index for pre-commit
hooks. Its JSON uses all four report projections; `actions` is empty except
when `check --remote` attempts its fetch. Exit code `0` means valid, `1` means
invalid or unavailable, and `2` means invalid CLI usage. A failed or
unavailable check must not allow a commit.

Create or repair configuration through ordinary reviewed file editing.
Silvermoon reports every configuration finding but has no init or setup command.

## Idea storage

Each idea is self-contained:

```text
.silvermoon/ideas/<ULID>/
|-- status.yaml
|-- ledger.md
`-- outer/
    |-- Deployment.md
    `-- inner/
        |-- Implementation.md
        `-- ideal/
            `-- Idea.md
```

Ideal World (理想世界) uses the `Idea.md` ideal contract.
Inner World (主体世界) uses the `Implementation.md` inner implementation
contract. Outer World (现实世界) uses the `Deployment.md` real-world
deployment contract. Each world may have supporting files and directories, but
they serve rather than replace the canonical same-world entry.

The nested opaque Git trees produce `idealRevision`,
`implementationRevision`, and `deploymentRevision`. Inner World includes Ideal
World; Outer World includes both nested worlds. `status.yaml` and required
`ledger.md` are outside all three revisions. Silvermoon requires ledger as a
regular file but does not parse its body.

Write implementation and deployment plans under `## Steps` and their outcome
contracts under `## Acceptance criteria`. Give every item a stable level-three
`I-Sxx`, `I-ACxx`, `D-Sxx`, or `D-ACxx` heading. Each criterion describes both
the observable outcome and how to prove it. Keep task-list checkboxes out of
world contracts.

Agents mirror those stable IDs and short titles into the required `ledger.md`
under Implementation and Deployment Steps and Acceptance criteria checklists.
Update both files together, and reset a checked item when its requirement or
proof changes materially. Checkboxes record Agent work only, never human
approval or acceptance.

```yaml
version: 1
id: 01M36QGPNTXEPP61DA4KP4AVZF
alias: publish-documentation
```

Status may additionally contain canonical `abandoned: true`,
`approvedRevision`, `implementationAcceptedRevision`, and
`deploymentAcceptedRevision` in that order. Decisions must bind to their
corresponding current world revision.

For a new scaffold, run `silvermoon create-idea`. It generates the ULID,
four structured documents and alias-less status; it does not stage, commit,
push, approve, or accept. During initial preparation, complete `Idea.md`,
replace the Implementation and Deployment placeholders with lightweight first
versions of no more than three high-level steps and three observable criteria
each, and mirror their stable IDs and short titles in the unchecked ledger.
These downstream seeds remain provisional and outside Idea acceptance. An Agent
may add a concise, unique alias derived from the user's request without asking
the user to choose a name.

## Adopting from another layout

Silvermoon deliberately has no runtime compatibility mode or in-place migration
command. It recognizes only `.silvermoon/config.yaml` and the fixed nested
world layout. A repository containing only another configuration or idea layout
is unconfigured.

Prepare one reviewed cutover commit with ordinary repository tools. Preserve
old Git history, inspect every retained outcome, and record only decisions that
have explicit evidence for the exact corresponding world revision. Silvermoon
does not read, merge, move, delete, diagnose, or infer facts from old layouts.

Run `silvermoon check --worktree`, stage the candidate, run the staged and
commit checks, publish non-force, then run the remote check against complete
primary history.
