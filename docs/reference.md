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
silvermoon whats-next [idea]
silvermoon create-idea [--language <tag>]
silvermoon check [--remote | --commit <revision> | --staged | --worktree]
```

`whats-next` and `create-idea` build one dialogue envelope:

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

Default dialogue output renders the same report with lightweight `##`
Markdown headings and concise lists: intent, observation, and next
instructions, with actions and outcomes only if `outcomes` is nonempty. JSON
always retains `outcomes: []` when no side effect was attempted. `--json`
serializes the same decision; there is no YAML output or second reasoning
path. Within `## Observation`, nonempty active ideas and observed problems
appear in separate level-three sections, `### Active ideas` and
`### Problems`. Chinese dialogue localizes these to `### 活跃 ideas` and
`### 问题`. Empty sections are omitted. Dialogue exit status `0` means a
trustworthy report was formed, even when it reports readiness blocks or a
failed operation; `1` means an internal failure prevented a trustworthy
report; `2` means invalid CLI usage.

Dialogue observation state is a discriminated union:

- `project-setup-required` uses `observedThrough` (`root`, `version`,
  `configuration`, or `ideas`) to identify the deepest reliable cumulative
  shape. Fields beyond that boundary are absent rather than null or fabricated.
- `repository-sync-required` always includes `root`, `version`,
  `configuration`, `ideas`, and at least one `problem`.
- `task-pending` includes all observation fields, no readiness problems, and
  work that can be selected or continued.
- `idle` has the same complete shape, no problems, and no active ideas.

Dialogue versions have `version.type: "worktree"`. `ideas.counts` always has
`preparing`, `implementing`, `deploying`, `completed`, and `abandoned`;
`activeIdeas` contains only minimal references for the first three states.
Problems have only stable `type` and natural-language `summary`; remediation
belongs in dialogue `instructions`.

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

- `check` validates only the committed `HEAD` snapshot. It is not a
  pre-commit check.
- `check --worktree` validates the hypothetical commit formed from `HEAD`, the
  index, unstaged changes, and nonignored untracked files.
- `check --staged` validates the index snapshot for a pre-commit hook.
- `check --commit <revision>` validates one local commit snapshot.
- `check --remote` fetches primary using committed coordinates, validates its
  immutable tip, and proves retained revision facts against complete reachable
  primary history. Unrelated skill or idea findings in local `HEAD` do not
  block locating and validating the remote snapshot.

Targets are mutually exclusive and never change the caller's branch, index, or
worktree. `--remote` may fetch Git objects, but it does not produce dialogue
outcomes. `check` validates the selected snapshot's project contract only:
Git, configuration, canonical skill, idea layout, world revisions, and status.
It does not check local worktree cleanliness, upstream, or ancestry readiness,
route ideas, or give next-step instructions.

Unlike dialogue commands, `check --json` contains **only** `intention` and
`observation`:

```json
{
  "intention": {
    "command": "check",
    "args": { "target": { "type": "staged" } }
  },
  "observation": {
    "state": "project-ready",
    "root": "D:\\Code\\silvermoon",
    "version": { "type": "staged" },
    "configuration": {
      "primaryRepository": "https://example.com/owner/repository.git",
      "primaryBranch": "main",
      "preferredLanguage": "en-US"
    },
    "ideas": {
      "counts": {
        "preparing": 0,
        "implementing": 0,
        "deploying": 0,
        "completed": 0,
        "abandoned": 0
      },
      "activeIdeas": []
    },
    "problems": []
  }
}
```

`intention.args.target.type` is `head`, `staged`, `worktree`, `commit`, or
`remote`; a requested `--commit` revision stays in intention. A resolved
`HEAD` or local commit is reported in observation as
`version: { type: "commit", commit: "<oid>" }`; a fetched remote tip is
`{ type: "remote", commit: "<oid>" }`. Failed commit resolution or fetch
reports `commit: null` and a problem. Staged and worktree versions only
contain `type`.

The `check` observation has its own discriminated states:

- `project-ready` has root, version, resolved configuration, idea summary,
  and empty problems. It says nothing about repository synchronization.
- `project-setup-required` has nonempty problems and the same progressive
  `observedThrough` variants as project setup in the dialogue.
- `check-unavailable` has known root, target version, and nonempty problems
  when the target cannot be resolved, fetched, or materialized; it does not
  pretend the project was checked.

There are no `outcomes` or `instructions` keys in a check report. Its default
human-readable output gives only the target, validation conclusion, and
problems, not the dialogue's four sections. Text and JSON derive from the same
validation result. Exit code `0` means `project-ready` and is the **only**
pre-commit/CI pass condition. Exit code `1` means invalid, unavailable, or an
internal failure and must fail closed; `2` means invalid CLI usage. Do not
infer success merely from a rendered report or empty-looking output.

Runtime checks verify canonical YAML, fixed paths, the three world entries,
unique aliases, Git object format, tree object types, per-world candidate
revision binding, and acceptance history.

## Schemas

- [Repository configuration](../schema/v1/config.schema.json)
- [User configuration](../schema/v1/user-config.schema.json)
- [Idea status](../schema/v1/idea-status.schema.json)
- [Shared definitions](../schema/v1/definitions.schema.json)
