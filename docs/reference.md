# Technical Reference

This page is the authoritative reference for Silvermoon storage, revisions,
derived state, CLI reports, and validation.

## Fixed Storage Layout

Each idea is self-contained under one canonical uppercase ULID:

```text
.silvermoon/
|-- config.yaml
`-- ideas/
    `-- 01M36QGPNTXEPP61DA4KP4AVZF/
        |-- status.yaml
        |-- ledger.md
        `-- outer/
            |-- Deployment.md
            `-- inner/
                |-- Implementation.md
                `-- ideal/
                    `-- Idea.md
```

Every world may contain supporting files and directories, but they serve the
canonical same-world entry and never define another contract. Metadata paths
are fixed regular files and directories.

The optional user configuration is always
`~/.config/silvermoon/config.yaml`, on every platform. It is outside the
repository and contains version 1 plus an optional `preferredLanguage`.
Missing user configuration means no user preference; an invalid or unreadable
explicit file is an error rather than a silent fallback.

The repository configuration accepts optional `preferredLanguage` after
`primaryBranch`. Stored language values are canonical BCP 47 tags.

## World Revisions

Each world is an opaque Git tree:

- `idealRevision` identifies `ideal/`.
- `implementationRevision` identifies `inner/` and includes the Ideal World.
- `deploymentRevision` identifies `outer/` and includes both nested worlds.

`status.yaml` and `ledger.md` are outside all three world trees. The repository
object format in use determines revision shape; Silvermoon validates object
types and candidate bindings rather than interpreting world contents.

## Status File

```yaml
version: 1
id: 01M36QGPNTXEPP61DA4KP4AVZF
alias: publish-documentation
language: zh-CN
approvedRevision: 0123456789abcdef0123456789abcdef01234567
implementationAcceptedRevision: 0123456789abcdef0123456789abcdef01234567
deploymentAcceptedRevision: 0123456789abcdef0123456789abcdef01234567
```

`version` and `id` are required. `alias` and canonical BCP 47 `language` are
optional. Other optional keys, in canonical order, are `abandoned: true` and
the three revision fields shown above. `language` is status outside every
world revision and does not change lifecycle decisions. Explicit
`abandoned: false`, derived state, criteria mirrors, source locators, unknown
keys, YAML aliases or anchors, comments, and noncanonical YAML are rejected.

Effective language resolves as `idea language > project preferredLanguage >
user preferredLanguage > en-US`. Every complete observation exposes the
resolved non-empty tag as `configuration.preferredLanguage`. Missing idea
language remains dynamically inherited and is never written back.

State is derived in order:

1. `abandoned` when `abandoned: true`.
2. `preparing` when `approvedRevision` differs from `idealRevision`.
3. `implementing` when `implementationAcceptedRevision` differs from
   `implementationRevision`.
4. `deploying` when `deploymentAcceptedRevision` differs from
   `deploymentRevision`.
5. `completed` when all three revisions match.

## Public Commands

```sh
silvermoon whats-next [idea] [--trace <trace-jsonl-file-name>]
silvermoon create-idea [--language <tag>] [--trace <trace-jsonl-file-name>]
silvermoon check [--remote | --commit <revision> | --staged | --worktree] [--trace <trace-jsonl-file-name>]
```

All three commands build one internal conversation envelope:

```json
{
  "intention": {
    "command": "whats-next",
    "args": {
      "idea": null
    }
  },
  "observation": {},
  "outcomes": [],
  "instructions": ""
}
```

- `intention` contains the command and normalized business arguments. Output
  format is not part of the intention.
- `observation` describes one repository version, resolved configuration, idea
  inventory, and project or repository readiness problems.
- `outcomes` records only high-level repository side effects actually
  attempted by this invocation. Each item has `type`, `status` (`success` or
  `failure`), and `summary`. An empty array means no side effect was attempted.
- `instructions` contains all ordered next-step guidance for the current
  readiness layer.

Default output renders that same envelope as four natural-language sections:
intent, observation, actions and outcomes, and next instructions. `--json`
serializes it directly; there is no YAML output and no second reasoning path.

All commands accept `--trace <trace-jsonl-file-name>`. The trace is newline-
delimited JSON with paired `span-start` and `span-end` events, UTC timestamps,
monotonic `durationMs`, parent span IDs, and success or error status. It covers
the command, snapshot observation, adoption, user configuration, idea layout,
repository readiness, temporary snapshot materialization, and individual Git
commands. Git events record the subcommand and result but not command arguments,
stdout, or stderr. The path is relative to the caller's working directory when
not absolute. Events are buffered so a trace inside the repository cannot
affect that invocation's worktree observation. The file is written after the
measured command work finishes and uses exclusive creation, so an existing
file is never overwritten.

Observation state is a discriminated union:

- `project-setup-required` uses `observedThrough` (`root`, `version`,
  `configuration`, or `ideas`) to identify the deepest reliable cumulative
  shape. Fields beyond that boundary are absent rather than null or fabricated.
- `repository-sync-required` always includes `root`, `version`,
  `configuration`, `ideas`, and at least one `problem`.
- `task-pending` includes all observation fields, no readiness problems, and
  work that can be selected or continued.
- `idle` has the same complete shape, no problems, and no active ideas.

`version.type` is `worktree`, `staged`, `commit`, or `remote`. Commit and remote
versions include the resolved commit, or `null` when resolution failed and a
problem explains why. `ideas.counts` always has `preparing`, `implementing`,
`deploying`, `completed`, and `abandoned`; `activeIdeas` contains only minimal
references for the first three states. Problems have only stable `type` and
natural-language `summary`; remediation belongs in `instructions`.

Project setup is ecosystem-neutral. It checks Git, configuration schema
compatibility, and exact canonical skill content at
`.agents/skills/silvermoon`. It does not inspect execution source or require a
package manager, `package.json`, project-local Silvermoon dependency, or
`node_modules`.

`whats-next` checks local conflicts and changes before remote access, then HEAD
and upstream identity, then fetch and ancestry. A local branch may have any
name, but its upstream must identify the configured repository and primary
branch. Change summaries have fixed item and UTF-8 byte budgets and provide
full counts, omitted counts, and exact inspection commands. Bare navigation
never selects an idea: it always lists every active idea alongside the option
to discuss and run `create-idea`.

`create-idea` applies the same hygiene preflight and then creates one canonical
scaffold. Its optional language override is normalized before preflight and is
the only command override; without it the status remains dynamically
inherited. It does not stage, commit, push, or record approval.

## Validation Targets

- `check` validates only the committed `HEAD` snapshot and reads primary
  coordinates from that snapshot.
- `check --worktree` validates the hypothetical commit formed from `HEAD`, the
  index, unstaged changes, and nonignored untracked files.
- `check --staged` validates the index snapshot.
- `check --commit <revision>` validates one local commit snapshot.
- `check --remote` fetches primary using committed coordinates, validates its
  immutable tip, and proves retained revision facts against complete reachable
  primary history.

Targets are mutually exclusive and never change the caller's branch, index, or
worktree. Exit status `0` means Silvermoon formed a complete trustworthy
envelope, including validation findings, readiness blocks, and reported fetch
or scaffold failures. Exit status `1` is reserved for an internal failure that
prevents such an envelope. Exit status `2` means invalid CLI usage before a
valid intention exists.

Runtime checks verify canonical YAML, fixed paths, the three world entries,
unique aliases, Git object format, tree object types, per-world candidate
revision binding, and acceptance history.

## Schemas

- [Repository configuration](../schema/v1/config.schema.json)
- [User configuration](../schema/v1/user-config.schema.json)
- [Idea status](../schema/v1/idea-status.schema.json)
- [Shared definitions](../schema/v1/definitions.schema.json)
