---
name: silvermoon
description: "Navigate or create repository-owned ideas from layered observations and ordered safe instructions."
argument-hint: "[new | idea ULID or alias]"
user-invocable: true
---

# Silvermoon

Use Silvermoon to navigate or create ideas against the configured primary.
The CLI observes repository and lifecycle state; the Agent performs instructed
repository or external actions with ordinary tools and Git.

## Choose And Run The Command

- `/silvermoon new` and other explicit new-idea requests use
  `silvermoon create-idea`. Otherwise use `silvermoon whats-next [idea]`, passing
  a selector only when the user supplied or previously selected it.
- Bare `whats-next` lists active ideas and offers creation, even when exactly one idea is active.
  Never infer selection; require an explicit ULID or alias.
- Use `--json` only when a programmatic consumer needs the envelope.
- Treat each command's `intention`, `observation`, `outcomes`, and `instructions`
  as one report. Read every problem and all ordered instructions; never combine
  reports.
  `project-setup-required` blocks repository work, `repository-sync-required`
  blocks idea routing, and `repository-preparation-required` blocks creation.
  Reobserve after resolving a blocker or making an expected change.
- Markdown is a rendering of the report, not a second decision model. A
  selected idea reports its lifecycle state; creation reports its new identity.

`whats-next` may fetch and inspect but never changes files, branches, index, or
refs. `create-idea` requires the configured primary branch and upstream plus a
clean worktree; it does not fetch or compare ancestry. The target does not need
a package manifest, package manager, Silvermoon dependency, or `node_modules`.
The packaged skill is canonical; register it at `.agents/skills/silvermoon`
with the supported `npx skills add` universal target. Silvermoon reports setup
problems but does not repair them.

`check` validates only a project snapshot; it does not navigate ideas or check
repository synchronization. Default `check` validates committed `HEAD`;
`--worktree` validates the full candidate and `--staged` the index. Its JSON
contains `intention` and `observation` only. Exit `0` means valid, `1` invalid
or unavailable, and `2` invalid usage. Never commit unless the relevant check
exits `0`.

## Preserve Work

- Inspect all staged, unstaged, and untracked changes before acting. Preserve
  unknown, unrelated, or user-authored work; isolate it or use only an
  explicitly described stash when necessary.
- Never use force-push, reset, broad clean, or silent history rewrites. Delete
  only operation-owned paths or paths the user explicitly names.
- Follow reported synchronization steps in order and use the reported primary
  tip as the expected remote tip. On rejection or concurrent movement, preserve
  both histories and reobserve; never replay a stale decision.

## Create And Publish An Idea

`create-idea` creates only the scaffold: `Idea.md`, `Implementation.md`,
`Deployment.md`, `ledger.md`, and `status.yaml`. It never stages, commits,
pushes, or records a decision. Preserve explicit creation intent through
hygiene retries: retry `create-idea`, not bare `whats-next`.

During preparation, complete the `Idea.md` ideal contract. Keep the
Implementation, Deployment, and matching ledger placeholders synchronized
until their lifecycle actions. Review every generated path and validate the
candidate, then commit and publish it to configured primary through the normal
non-force path before asking the user to review or approve it. Verify the commit
is reachable from refreshed primary and reobserve the exact `idealRevision`.
If publication requires a pull request, wait until it reaches primary. If
publication is blocked, say the candidate is not yet available for cross-device
review; never ask for approval of unpublished content. Publication is not
approval and must not change `status.yaml`.

An Agent may derive a concise, unique alias; do not ask for a name solely for
the alias. Pass `--language <tag>` only when the user explicitly requests a
stable language override. Do not use that option with `whats-next` or `check`.

## Continue The Selected Idea

Use the reported `ledgerPath` after lifecycle hygiene and continue only the
selected world's unfinished work:

- **Preparing:** Edit `Idea.md` and supporting Ideal World (理想世界) files.
  Supporting files serve the contract, not replace it. After explicit approval,
  record the reported `idealRevision` as `approvedRevision`.
- **Implementing:** Edit `Implementation.md`, supporting Inner World (主体世界)
  files, and repository deliverables. Change the ideal only if it truly changed
  and the idea must return to preparing. After explicit acceptance, record the
  reported `implementationRevision` as `implementationAcceptedRevision`.
- **Deploying:** Use `Deployment.md` and supporting Outer World (现实世界) files
  to drive and verify external outcomes; do not change repository deliverables.
  Publish a new or materially changed deployment contract first, reobserve its
  stable `deploymentRevision`, then run checks against it and record evidence
  in the ledger. After explicit acceptance, record the reported
  `deploymentRevision` as `deploymentAcceptedRevision`.
- **Abandoned:** Keep canonical `abandoned: true`, remove it only after an
  explicit reversal, or choose another idea.
- **Completed:** Revise its definition or create a different idea.

## Author Contracts And Continue From The Ledger

Each idea has three canonical entries:

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

`Idea.md` is the Ideal World (理想世界) ideal contract, `Implementation.md` is
the Inner World (主体世界) inner implementation contract, and `Deployment.md`
is the Outer World (现实世界) real-world deployment contract. Each world may
contain supporting files, but those artifacts serve the same-world entry and
never define a second contract.

In `Implementation.md` and `Deployment.md`, put plans under `## Steps` and
outcomes under `## Acceptance criteria`. Use stable level-three IDs: `I-Sxx`,
`I-ACxx`, `D-Sxx`, and `D-ACxx`. Each criterion states an observable outcome
and how to prove it. Do not put checkboxes in world contracts. World content
changes its world revision and containing revisions; `status.yaml` and
`ledger.md` are outside those trees.

The required idea-root `ledger.md` is operational memory, not a fourth world,
contract, or human decision. Mirror the stable IDs and short titles for
Implementation and Deployment steps and criteria. Update ledger entries with
their contract changes; add new items unchecked and reset completed items when
requirements or proof change materially. If relevant entries remain unchecked,
continue the reported work. If they are all checked, evidence remains valid,
and the candidate is published, stop and request the appropriate explicit
acceptance. A checked box records Agent work only; it never approves, accepts,
changes status, or authorizes publication.

## Record Decisions And Request Review

Silvermoon has no approval, acceptance, or abandonment mutation commands. After
an explicit human decision, reconfirm it applies to the selected idea and exact
revision from `whats-next`; change only the corresponding status fact. Never
infer a decision from silence, prose, Git activity, ledger checkboxes, or an
outer command.

Before requesting approval or acceptance, identify the idea by alias and ULID,
state the decision and exact reported world revision, and include a clickable
permalink to the canonical entry at the published primary commit: `Idea.md`
for ideal approval, `Implementation.md` for implementation acceptance, or
`Deployment.md` for deployment acceptance. Prefer a commit-pinned web URL (for
GitHub, `/blob/<commit>/<path>`), not a local path or moving branch link.
Confirm the commit is reachable from refreshed primary. If no reliable
permalink can be formed, give the commit and repository-relative path and
explain why; never provide a misleading link. Publication and links enable
review but do not constitute the user's decision.

For status changes, validate with `silvermoon check --worktree`, stage the
candidate, then run `silvermoon check --staged`. Commit separately when
practical and publish non-force using the latest reported primary tip.

## Advance Safely

Rerun the intent-preserving command only after an expected repository change,
unexpected input, or new external result. Stop when waiting for a human or
external result; do not poll an unchanged observation. Report actionable
blockers and their recovery condition.

Follow [adoption.md](./references/adoption.md) when creating or explicitly
converting a repository to Silvermoon.
