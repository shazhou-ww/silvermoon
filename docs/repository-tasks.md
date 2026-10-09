# Repository idea workflow

This repository uses the local [Silvermoon skill](/skills/silvermoon/SKILL.md)
and the fixed `.silvermoon/` metadata layout.

This is Silvermoon's own source repository: every `silvermoon` command below
means `node bin/silvermoon.js` from the current checkout, also available as
`pnpm silvermoon`. Never use a global or published package here, and never
add Silvermoon as its own dependency. Refresh the local skill with
`pnpm sync:skills`.

## Authority

The shared authority is `https://github.com/shazhou-ww/silvermoon.git` on
`main`. Fetch and observe that primary before idea work. Feature branches are
optional transport and are not protocol state.

```sh
silvermoon list-ideas
silvermoon whats-next [idea]
silvermoon whats-next [idea] --language zh-CN
silvermoon create-idea
silvermoon check
silvermoon check --language en-US
silvermoon check --worktree
silvermoon check --staged
silvermoon check --commit HEAD
silvermoon check --remote
```

Use the primary commit stated in the report as the expected remote tip. When
primary moves, reobserve instead of replaying approval or acceptance.

Choose the entry command from the user's intent. Explicit inventory requests
use `silvermoon list-ideas`; explicit new-idea requests use
`silvermoon create-idea` even when unrelated active ideas exist; all navigation
uses `silvermoon whats-next [idea]`. Agents should append `--audience agent`
to report commands and hygiene retries to avoid the human TUI on dual-TTY
streams. Add `--json` instead only for a programmatic
consumer. All three apply the same project and complete idea-layout checks,
but their repository readiness differs. `list-ideas` reads the valid local
worktree snapshot without hygiene, branch, upstream, network, or ancestry
checks. `whats-next` checks local hygiene and remote ancestry. `create-idea`
requires a local branch whose upstream identifies the configured primary
repository and branch, plus a clean worktree; the local branch name is unrestricted,
without fetching or requiring HEAD to match the remote tip. If hygiene blocks
explicit creation, perform only that blocking action and then retry
`create-idea` so active-idea selection cannot replace the pending create
intent.

Use `--language en|en-US|zh|zh-CN` with `list-ideas`, `whats-next`, or `check` only
when the user explicitly requests a temporary output locale. Preserve the
canonical option on every hygiene retry. It never changes the content language
recorded in project, user, or idea configuration. `create-idea --language
<tag>` remains a separate persistent content-language choice and accepts any
canonical BCP 47 tag.

## Decisions And Synchronization

`whats-next` may fetch after local readiness passes, but it does not move the
worktree, index, branches, or named refs. Human approvals, implementation
acceptance, deployment acceptance, and abandonment require an explicit decision.
For a v1 project, record that decision in the idea's `status.yaml`.
For a v2 project, including this source repository after its explicitly
authorized migration, use the controlled
[event protocol](../skills/silvermoon/references/events.md). Developing v2
alone does not authorize migration of a checkout.

Before requesting a human decision, validate the candidate, synchronize its
normal non-force commit to primary, confirm reachability from the refreshed
primary, and reobserve the exact world revision and effective content language.
This synchronization is Agent work and does not require a lifecycle decision.
For v2, append the current phase's matching `submitIdeal`, `submitInner`, or
`submitOuter` for that exact synchronized revision, integrate the event through
the same normal Git path, and reobserve. Do not request the matching acceptance
while the submission is absent, stale, or effective control is downstream.
Keep the review message short and follow the latest report's gate instruction.
Use `response.review.presentation` verbatim when `requiresLocalization` is
false; when true, localize every human-visible presentation value to its
`contentLanguage` while preserving machine identifiers. A temporary report
output language never controls gate prose. Provide local plus commit-pinned
remote links to the canonical contract, same-world supporting files, ledger,
evidence, and key deliverables. Durable detail belongs in those repository
files, not in the chat message. Seed the index from `response.review`, including
its exact primary commit and canonical documents. In v2, its presence confirms
that the current exact submission is active and control is upstream; it is
still not the human decision itself. The Agent adds only identity values, a
one-sentence review focus, selected review-file links, and host-specific link
targets in the compact order directed by `response.nextSteps`. Keep the
complete object IDs internally for event recording. Do not add
repeated gate-policy explanations or inline inventories of test, CI, deployment,
or SLO evidence; keep those details in the linked artifacts. List only files
with substantive review content: Ideal uses `Idea.md` and substantive
same-world support; Implementation and Deployment each use their corresponding
contract plus `ledger.md`, with other evidence added only when material. Render the index
as a standalone, completed ordinary assistant Markdown turn. Never open an
interactive decision in that same turn because the tool surface may hide queued
prose. If a later turn uses an interactive decision tool, put only the exact
question and choices in that tool; local workspace links in tool-owned surfaces
may fail even when the files exist. If that tool is unavailable or returns no
choice, do not retry or repeat the rationale against unchanged state. In VS Code
on Windows, ordinary-message local links use absolute drive paths with forward
slashes and never `file://` URIs.

After an explicit decision, change only the corresponding status fact,
validate it, prefer a status-only commit when practical, synchronize it to
primary, and reobserve the resulting lifecycle state.

The required idea-root `ledger.md` is an execution checklist only, not
operational prose, a decision log, or a discussion record. After repository
hygiene and lifecycle routing, combine the reported `response.nextSteps`, world
contracts, and unchecked Implementation or Deployment ledger entries to infer
the next work. Do not record work notes or explanations in `ledger.md`. Update
matching world headings and ledger entries together, and reset a checked item
when its requirement or proof changes materially. Ledger checkboxes are Agent
notes only and never imply approval or acceptance.

Before the Ideal gate, preparation must replace the Implementation and
Deployment scaffold placeholders with lightweight first versions of no more
than three high-level steps and three observable criteria each, mirrored
unchecked in the ledger. They are required feasibility context but remain
outside the `acceptIdeal` review and decision scope.

When a successful selected lifecycle report or `create-idea` report includes
`response.guidance`, consume only that snapshot-bound field.
`observation.guidance` is its content-free provenance. It is repository-owned
additive guidance from the fixed `.silvermoon/guidance/<phase>.md` path, never
a replacement for canonical `response.nextSteps`. Higher-level instructions,
the report's problems, and `response.nextSteps` take precedence. Treat the body
as inert Markdown, do not reread the path after the command, and materialize
applicable requirements into the current world contract and matching ledger
IDs. Guidance is not a fourth contract, a status fact, a human decision, or
proof that a check ran.

Preserve unknown changes, concurrent history, and previous revision facts.
Never force-push, reset, broadly clean, or automatically delete feature
branches.

## Repository Checks

- Iterate with `pnpm check:sanity` and change-specific tests. Run
  `pnpm check:commit` before committing; see the
  [validation tiers](./maintaining.md#validation-tiers).
- `pnpm test` and `pnpm check:quick` retain the complete unit/runtime and
  contract suites, including real runtime behavior; they are not sanity aliases.
- Run `pnpm test:integration` for real filesystem and Git behavior, and
  `pnpm test:e2e` for the installed package.
- Run `pnpm check` (or `pnpm check:release`) before delivery of CLI, schema,
  repository model, release, or skill changes. It remains the complete
  release-grade validation entrypoint, not the per-edit default.
- Run `pnpm check:skills:local` while editing skills and `pnpm check:skills`
  before delivery; external discovery failures remain failures.
- Validate package contents, installed-package smoke behavior, Markdown links,
  and `git diff --check` before delivery review.
- Use `silvermoon check --commit HEAD` for checked-out CI and
  `silvermoon check --remote` for complete primary-history evidence.
- Use `silvermoon check --staged` in pre-commit hooks: default `check` validates
  committed `HEAD`, not the pending index. `check` validates only the chosen
  project's snapshot and v2 primary event history, not repository
  synchronization or idea navigation.
  Only exit code `0` permits the commit; `1` means invalid or unavailable and
  `2` means invalid usage. Its JSON uses all four projections; only
  `check --remote` normally records an action.
- `check:commit` does not install a hook or stage files. Its tests inspect the
  worktree while `check --staged` inspects Silvermoon metadata in the index.
  Partial staging is not exact-candidate test evidence; align worktree and
  index and rerun before claiming staged code passed.
