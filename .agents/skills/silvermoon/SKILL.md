---
name: silvermoon
description: "Navigate or create repository-owned ideas from layered observations and ordered safe instructions."
argument-hint: "[new | idea ULID or alias]"
user-invocable: true
---

# Silvermoon

Use Silvermoon to navigate or explicitly create ideas against the configured
remote primary. The CLI derives idea state and checks repository hygiene; the
Agent performs suggested repository or external actions through ordinary tools
and Git.

## Start From Primary

1. Preserve the user's intent when choosing the entry command:
   - For `/silvermoon new` or any other explicit request to create a new idea,
     run `silvermoon create-idea`.
   - Otherwise run `silvermoon whats-next [idea]`. Pass the selector only when
     the user supplied or previously selected one.
   - Use `--json` when a programmatic consumer needs the structured envelope;
     otherwise read the default conversation.
2. Treat `intention`, `observation`, `outcomes`, and `instructions` as one
   immutable report from a single invocation. Do not combine guidance from
   different reports. The default text renders those same four sections; it is
   not a second decision model.
3. Read every problem and all ordered instructions in the current layer.
   `project-setup-required` blocks repository and idea reasoning;
   `repository-sync-required` blocks idea routing. Execute instructions whose
   prerequisites remain true, and reobserve after completing the layer or
   encountering an unexpected result.
4. Never infer selection from candidate count. Bare `whats-next` presents all
   active ideas and the option to discuss and run `create-idea`, even when
   exactly one idea is active. Only an explicit ULID or alias selects an idea.
   After resolving hygiene for an explicit create request, retry `create-idea`,
   not selector-less `whats-next`.

`whats-next` may fetch and inspect. It never checkout, merges, edits, commits,
stashes, deletes, resets, fast-forwards, or pushes. `create-idea` runs the same
hygiene preflight and, only when it passes, creates the structured idea scaffold.
The target repository does not need a package manifest, package manager,
Silvermoon dependency, or `node_modules`. The packaged skill is canonical;
register or update it only at `.agents/skills/silvermoon` through the supported
`npx skills add` universal target. Silvermoon reports configuration and skill
problems but owns no setup mutation command.

## Preserve Work

- Read exact staged, unstaged, and untracked diffs before deciding ownership.
- Preserve unknown, unrelated, or user-authored changes. Isolate them in
  another worktree or use an explicitly described stash only when needed.
- Delete only paths created by the current operation or paths the user names
  after reviewing the current diff.
- Never use force-push, `reset --hard`, broad clean commands, or silent history
  rewrites to satisfy guidance.
- When instructions report an observed primary tip, use it as the expected
  remote tip. On rejection or concurrent movement, call `whats-next` again;
  never replay a stale approval or acceptance automatically.

## Follow Instructions

- For bare navigation, show the ordered active candidates and obtain one
  explicit ULID or alias selection, or discuss a new goal and invoke
  `create-idea`.
- For an explicit `create-idea`, do not replace the user's create intent with
  active-idea selection. After hygiene passes, the command creates one
  self-contained idea
  with structured `Idea.md`, `Implementation.md`, `Deployment.md`, and
  `ledger.md` entries plus alias-less `status.yaml`. It never stages, commits,
  pushes, or records a decision. Review every generated path before
  publication. During initial preparation, replace the `Idea.md` guidance with
  the requested Ideal World contract, but keep the Implementation, Deployment,
  and matching ledger placeholders synchronized until their lifecycle actions.
  An Agent may add a concise, unique alias derived from the user's request;
  do not interrupt the user only to ask them to name it.
  When the user explicitly requests a stable language for the new idea, pass
  `--language <tag>`; otherwise omit it so the idea dynamically inherits the
  project, user, or `en-US` default. Never add a language override to
  `whats-next` or `check`.
- For repository synchronization instructions, perform the reported Git
  hygiene steps in order without discarding either history or unknown work.
  A local branch name may differ from the configured primary branch, but its
  upstream must identify the configured repository and branch.
- For a preparing idea, edit `Idea.md` and supporting files in the Ideal World
  (道心). Supporting files must serve `Idea.md`, never replace it as a second
  contract. After lifecycle hygiene, use the reported `ledgerPath` to resume
  relevant unfinished work. After explicit approval, write the reported
  `idealRevision` to `approvedRevision`.
- For an implementing idea, edit `Implementation.md`, its supporting Inner World
  (内景) files, and repository deliverables. Do not change the nested Ideal
  World unless the ideal truly changed and should return to preparing. After
  lifecycle hygiene, use the reported `ledgerPath` to resume relevant
  unfinished work. After explicit acceptance, write the reported
  `implementationRevision` to `implementationAcceptedRevision`.
- For a deploying idea, use `Deployment.md` and its supporting Outer World (现世)
  files to drive and verify the external world. Do not change repository
  deliverables as deployment work or modify a nested world unless that earlier
  contract truly changed. Publish a newly authored or materially changed
  deployment contract first, reobserve its stable `deploymentRevision`, then
  execute external checks against that revision and record their completion in
  the ledger. After lifecycle hygiene, use the reported `ledgerPath` to resume
  relevant unfinished work. After explicit acceptance, write the reported
- For an abandoned idea, keep `abandoned: true`, remove it after an explicit human
  decision, or create a different idea.
- For a completed idea, revise the existing idea definition or create a new idea.

## Author The Three Worlds

Every idea uses this fixed structure:

```text
.silvermoon/ideas/<ULID>/
├── status.yaml
├── ledger.md
└── outer/
    ├── Deployment.md
    └── inner/
        ├── Implementation.md
        └── ideal/
            └── Idea.md
```

`Idea.md` is the canonical Ideal World (道心) entry, `Implementation.md` is the
canonical Inner World (内景) entry, and `Deployment.md` is the canonical Outer
World (现世) entry: 道心立意，内景成形，现世验真. Each world may contain
additional files and nested directories, but those artifacts support their
same-world entry and do not define a second contract.

In `Implementation.md` and `Deployment.md`, put plans under `## Steps` and
outcome contracts under `## Acceptance criteria`. Give every step and criterion
a stable level-three heading: `I-Sxx`, `I-ACxx`, `D-Sxx`, or `D-ACxx`. A
criterion must describe both its observable outcome and the method that proves
it; do not add a separate validation section. Keep checkboxes out of world
contracts. World content changes its world revision and every containing world
revision; `status.yaml` and `ledger.md` stay outside all three world trees.

## Continue From The Ledger

Every idea has an Agent-owned `ledger.md` at the path reported by `whats-next`.
It is operational state, not a fourth world, normative contract, or human
decision. Silvermoon requires the regular file but does not parse its body or
derive lifecycle state from it.

Mirror stable IDs and short titles from both world contracts:

```markdown
# Ledger

## Implementation

### Implementation steps

- [x] **I-S01:** Completed step
- [ ] **I-S02:** Remaining step

### Implementation acceptance criteria

- [x] **I-AC01:** Proven criterion
- [ ] **I-AC02:** Unproven criterion

## Deployment

### Deployment steps

- [ ] **D-S01:** Deployment step

### Deployment acceptance criteria

- [ ] **D-AC01:** Deployment criterion
```

When adding or removing a world step or criterion, update the matching ledger
entry in the same change. Keep its stable ID when only the title or details are
refined. Add new entries unchecked. If a completed item's requirement or proof
method changes materially, reset its checkbox and re-run the work or proof.
Infer the next action from `whats-next`, the world contracts, and unchecked
ledger entries; do not maintain duplicate Current or Next summaries.
If relevant ledger entries remain unchecked, continue the reported world
action. If all relevant entries are checked, their evidence remains valid, and
the candidate is published, stop editing and request explicit acceptance for
the exact revision reported by `whats-next`.

`[x]` means only that the Agent recorded work or a check as complete. It never
approves an Ideal World, accepts implementation or deployment, changes
`status.yaml`, or authorizes publication. Record test names, commands,
artifacts, and results in the corresponding world criterion or concise ledger
notes without creating a separate evidence schema or public API contract.

## Write Status Facts

Silvermoon has no approval, acceptance, or abandonment mutation commands.
Update the idea's `status.yaml` with ordinary file editing:

1. Reconfirm the decision applies to the selected idea and current
   world revision reported by `whats-next`.
2. Add or update only the corresponding revision field, or add/remove canonical
   `abandoned: true` after an explicit human decision.
3. Run `silvermoon check --worktree` while reviewing the complete candidate,
   then stage it and run `silvermoon check --staged`. Add `--json` only when a
   programmatic consumer needs the envelope.
4. Commit the status decision separately when practical, then non-force push
   with the primary tip reported by the latest instructions as the expected
   remote tip.

Never infer a human decision from silence, prose, Git activity, or an outer
command. Old revision values remain as history and become inactive naturally
when the idea folder changes.

## Advance The Loop

Re-run the intent-preserving entry command only after an expected repository
delta, an unexpected input change, or a newly arrived external result: use
`create-idea` for a pending explicit creation and `whats-next` otherwise. End
the current turn when waiting for human/external input. Report an actionable
error with its recovery condition, or report no progress and stop if guidance
completed without a delta. Never poll the same observation.

Follow [adoption.md](./references/adoption.md) when creating or explicitly
converting a repository to Silvermoon.
