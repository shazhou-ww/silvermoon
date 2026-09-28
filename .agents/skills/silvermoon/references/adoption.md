# Silvermoon adoption

## New repositories

Start with a complete diagnosis, even in an unfamiliar repository:

```sh
npx silvermoon@<version> whats-next
```

The dialogue uses lightweight Markdown headings for intention, observation,
and ordered instructions. It includes actions and outcomes only if side
effects were attempted. Add `--json` only when a programmatic consumer needs
the `intention / observation / outcomes / instructions` envelope (including
`outcomes: []` when none were attempted).
The command may fetch after local readiness passes, but it does not move the
worktree, index, branches, or named refs.

The target repository may use any language or build ecosystem. It does not
need `package.json`, a package manager, a Silvermoon dependency, or
`node_modules`. Use any compatible Silvermoon installation, and register the
canonical skill bundled with that running installation:

```sh
npx skills add <path-to-running-silvermoon>/skills --skill silvermoon --agent universal --yes --copy
```

This writes the single repository-local registration at
`.agents/skills/silvermoon`. Registration and updates belong to `npx skills`;
Silvermoon compares that path with its bundled canonical skill but never
overwrites it.

Create `.silvermoon/config.yaml` with the fixed version 1 contract:

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

`check` validates the selected project snapshot only; it does not navigate
ideas or check worktree hygiene and upstream. Default `check` validates
committed `HEAD`, whereas `check --staged` validates the index for pre-commit
hooks. Its JSON contains only `intention` and `observation`; it does not
include dialogue `outcomes` or `instructions`. Exit code `0` means valid,
`1` means invalid or unavailable, and `2` means invalid CLI usage. A failed
or unavailable check must not allow a commit.

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
push, approve, or accept. During initial preparation, complete `Idea.md` while
keeping the Implementation, Deployment, and ledger placeholders synchronized
until their lifecycle actions. An Agent may add a concise, unique alias derived
from the user's request without asking the user to choose a name.

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
