# Operating Silvermoon

This guide is the authoritative routine workflow for navigating, changing, and
publishing Silvermoon ideas.

## Navigate

```sh
npx silvermoon whats-next
npx silvermoon whats-next 01M36QGPNTXEPP61DA4KP4AVZF
npx silvermoon whats-next publish-documentation --json
```

Without a selector, Silvermoon asks for a choice among multiple active ideas,
and the option to discuss and create a new idea. This remains true with zero,
one, or many active ideas: only a selector chooses work. Completed and abandoned
ideas are excluded from default candidates. A selector is either a canonical
uppercase ULID or an exact, unique, case-sensitive alias.

The shared observation includes a resolved non-empty `preferredLanguage`.
Instructions use it for world entries, same-world supporting artifacts, the
ledger, and user-facing explanations. Commands, identifiers, schema fields,
protocol markers, and verbatim tool output retain their original form.

Every invocation follows three strict layers. It first checks Git,
configuration compatibility, and `.agents/skills/silvermoon`. It then checks
local conflicts, changes, HEAD, and upstream identity before any remote access.
Only after those checks pass does it fetch primary, compare ancestry, and
route idea work. It never edits, checks out, merges, commits, stashes, deletes,
resets, fast-forwards, or pushes.

## Create An Idea

Explicit creation uses:

```sh
silvermoon create-idea
silvermoon create-idea --language zh-cn
```

Creation intent is distinct from active-idea selection. If hygiene blocks the
command, perform only the reported remediation and retry `create-idea`; do not
replace the request with selector-less navigation.

`--language` is the only command-level language override. It normalizes a valid
BCP 47 tag and writes it to the new idea's `status.yaml`. Without the option,
creation writes no language field and the idea dynamically inherits project,
user, or `en-US` defaults. `whats-next` and `check` do not accept the option.

The generated files remain untracked for review. Complete `Idea.md`, optionally
add a concise unique alias, inspect every path, and publish the initial idea
through ordinary Git.

## Follow One Observation

Treat `intention`, `observation`, `outcomes`, and `instructions` as one
immutable dialogue report for `whats-next` and `create-idea`. Default output
uses lightweight Markdown headings and lists for intent, observation, and
next instructions, including actions and outcomes only if an operation was
attempted. `--json` serializes the same model, retaining `outcomes: []` when
none were attempted.

Project setup takes precedence over repository synchronization, which takes
precedence over lifecycle work. Instructions include every known remediation
for the current layer in priority order. Large change sets report complete
counts, bounded path samples, omitted counts, and exact commands for the full
diff. Preserve unknown and concurrent work. Never force-push, use
`reset --hard`, broadly clean the worktree, or silently rewrite history.

After an observable change, run `whats-next` again. Do not poll an unchanged
observation.

## Author World Contracts

`Idea.md` is the Ideal World entry. `Implementation.md` and `Deployment.md`
contain `## Steps` and `## Acceptance criteria`. Every item uses a stable
level-three heading:

- implementation steps: `I-Sxx`
- implementation criteria: `I-ACxx`
- deployment steps: `D-Sxx`
- deployment criteria: `D-ACxx`

Each criterion states both the observable outcome and how an Agent can prove
it. World contracts do not use task-list checkboxes.

The required idea-root `ledger.md` mirrors those IDs and short titles as
checkboxes under Implementation and Deployment. Update a world heading and its
ledger entry together. Add new items unchecked, and reset a completed item when
its requirement or proof changes materially.

## Record A Human Decision

After an explicit decision, reconfirm that it applies to the selected idea and
the current reported world revision. Edit only the corresponding status fact:

- `approvedRevision`
- `implementationAcceptedRevision`
- `deploymentAcceptedRevision`
- canonical `abandoned: true`, or remove it after an explicit reversal

Validate the complete candidate:

```sh
silvermoon check --worktree
git add .silvermoon/ideas/<ULID>/status.yaml
silvermoon check --staged
```

`check` is a project-only validator, not a navigation command. It does not
check worktree hygiene, upstream, or ancestry and does not suggest next steps.
Without a target it validates committed `HEAD`, not the pending commit.
`--worktree` validates the full candidate, while `--staged` validates exactly
the index and is the pre-commit hook target. Its JSON has `intention` and
`observation` only; it has no `outcomes` or `instructions`. Exit status `0`
means the chosen project snapshot is valid; `1` means invalid or unavailable
and must block the commit; `2` means invalid CLI usage. Do not treat the
existence of a report as permission to commit.

Prefer a status-only decision commit, publish through the repository's normal
non-force path, and verify the commit is reachable from refreshed primary.

## Publish Work

Before publication, compare with the observed primary tip, run checks focused
on the change, and inspect the exact diff. On push rejection, branch movement,
or a newly discovered conflict, preserve both histories, fetch, and reobserve.
Never replay approval or acceptance automatically against a new revision.
