# Technical Reference

This page is the authoritative reference for Silvermoon storage, revisions,
derived state, CLI reports, and validation.

## Fixed Storage Layout

Each idea is self-contained under one canonical uppercase ULID:

```text
.silvermoon/
|-- config.yaml
|-- guidance/
|   |-- preparing.md
|   |-- implementing.md
|   `-- deploying.md
`-- ideas/
    `-- 01M36QGPNTXEPP61DA4KP4AVZF/
        |-- status.yaml (v1) or events.jsonl (v2)
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

## Phase Guidance

The three files under `.silvermoon/guidance/` are optional fixed conventions,
not configuration fields. They are additive project input, not a fourth
contract, status fact, decision, or proof of completion:

| Phase | Repository-relative path |
| --- | --- |
| `preparing` | `.silvermoon/guidance/preparing.md` |
| `implementing` | `.silvermoon/guidance/implementing.md` |
| `deploying` | `.silvermoon/guidance/deploying.md` |

The directory must be a regular repository-owned directory and may contain
only those entries. Each present entry must be a regular file, not a symlink,
with at most 32 KiB of raw blob bytes. Content must be valid UTF-8 without a
BOM or NUL byte and must contain a non-whitespace character. CRLF is accepted
and report content is normalized to LF. Silvermoon treats the body as inert
Markdown: it does not parse frontmatter, interpolate values, resolve includes,
fetch URLs, execute snippets, translate content, or write it to traces.

Lifecycle commands use on-demand validation. Selected `whats-next` reads only
the selected actionable phase after project, local repository, fetch, and
ancestry readiness. `create-idea` reads only preparing guidance after local
preflight and before writing any scaffold path. Errors in another phase and
extra directory entries do not preempt those commands. Bare navigation,
selector misses, completed or abandoned ideas, and readiness blocks do not
read or return guidance.

All `check` targets use complete validation: they reject any invalid phase file
or extra entry in their selected HEAD, worktree, index, commit, or remote
snapshot. A missing directory or missing phase file is valid. Checks never
return guidance content.

## World Revisions

Each world is an opaque Git tree:

- `idealRevision` identifies `ideal/`.
- `implementationRevision` identifies `inner/` and includes the Ideal World.
- `deploymentRevision` identifies `outer/` and includes both nested worlds.

`status.yaml` (v1), `events.jsonl` (v2), and `ledger.md` are outside all three
world trees. The repository
object format in use determines revision shape. Silvermoon validates canonical
revision shape, computes the current world trees, and compares those values to
status facts rather than interpreting world contents.

## Status File (v1)

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

Effective content language resolves as `idea language > project
preferredLanguage > user preferredLanguage > en-US`. Every complete
observation exposes the resolved non-empty tag as
`configuration.preferredLanguage`. Missing idea language remains dynamically
inherited and is never written back. Dialogue project status presents this
effective value as `content language` (`内容语言`).

Every command observation also exposes an independent `outputLanguage`.
Silvermoon's built-in output locales are `en-US` and `zh-CN`; short aliases
`en` and `zh` are accepted and normalize to those locales.
`list-ideas`, `whats-next`, and `check` accept `--language
<en|en-US|zh|zh-CN>`, normalize casing, and apply the override only to the
current invocation. It takes display precedence over content language. Without
an explicit output override, content tags beginning with `zh` select `zh-CN`;
every other content tag selects `en-US`. Output selection never writes
configuration or idea status.

The effective content language governs natural-language prose, comments,
short titles, and placeholders in all three world contracts, their same-world
supporting files, and `ledger.md`. Canonical headings, stable IDs, paths, CLI
options, and schema fields remain unchanged. `create-idea` provides localized
scaffolds for built-in English and Chinese templates; for another canonical
BCP 47 tag it reports the explicit fallback template language and requires the
Agent to replace natural-language placeholders with the effective content
language. Selected-idea `whats-next` instructions repeat the effective content
language even when a temporary output-language override is active.

State is derived in order:

1. `abandoned` when `abandoned: true`.
2. `preparing` when `approvedRevision` differs from `idealRevision`.
3. `implementing` when `implementationAcceptedRevision` differs from
   `implementationRevision`.
4. `deploying` when `deploymentAcceptedRevision` differs from
   `deploymentRevision`.
5. `completed` when all three revisions match.

## Event State (v2)

Project `version: 2` replaces mutable status with a required `events.jsonl`
at each idea root. Identity comes from the directory and an empty log is
valid. Its strict nine-event union updates the status facts and interaction
projection; no observations, creation/import markers, or audit envelope are
stored. The nested-world revisions and five lifecycle states are unchanged.

Use `event replay`, `event append`, and `event revise`, never direct JSONL
editing. Requests carry exact log byte length and SHA-256 outside the business event;
lifecycle writes also require expected primary. Canonical JSONL, human gates, concurrency,
conditional append-only history, and interrupted-write recovery are specified
in the [event operations contract](../skills/silvermoon/references/events.md).
That contract also documents the separate `bin/migrate-v1-to-v2.js` entrypoint.
No command automatically migrates a v1 project.

V2's seven business types are `setAlias`, `setLanguage`, `acceptIdeal`,
`acceptInner`, `acceptOuter`, `abandon`, and `resume`. The two interaction
types, `ping` and `pong`, carry only a nonempty `message` string. Replay retains
ordered messages and `lastSignal` without treating a reply as completion or
removing older goals. After `abandon`, only `resume` is legal. Interaction
appends need the local byte precondition but no primary fetch; decisions
retain their primary and human revision gates. The CLI cannot authenticate
upstream or downstream senders.

## Experimental JavaScript Package API

The package root export is available for programmatic reuse, but remains
experimental for every Silvermoon `0.x` release. A minor release before
`1.0.0` may add, remove, rename, or change exported JavaScript functions and
classes without a deprecation period. Patch releases are intended for
compatible fixes. Consumers that import from `silvermoon` should pin the exact
package version and review the changelog before upgrading.

This boundary applies only to the root JavaScript export. The CLI, versioned
JSON Schemas, trace versions, and repository file contracts keep their own
documented compatibility rules. The package does not yet promise stable
TypeScript declarations or a stable `1.0.0` JavaScript API.

The `silvermoon/agents/copilot` subpath exports `CopilotAdapter` and
`LocalProjectRegistry` (with TypeScript declarations). This is a separate
experimental Agent integration, not part of the root export. Register a
local Git project first with `registry.register(projectUrl, projectRoot)`,
using its canonical credential-free HTTPS remote URL and a worktree root
whose `.silvermoon/config.yaml` names that remote. Then construct
`new CopilotAdapter({ registry, onPermissionRequest })`; callers must
explicitly decide Copilot tool permissions rather than inheriting blanket
approval. `start({ projectUrl, ideaId })` creates or reuses a dedicated worktree
whose branch tracks the project's configured primary, and a durable Copilot
session. A missing local primary tracking ref blocks creation rather than
guessing a base. `send`
returns an asynchronous stream of delivery observations, while `events`
returns only final Agent replies and `observe` returns session and activity
observations. Call `close()` to release connections; it does not delete
session history or worktrees.
An aborted turn or session error fails the formal reply stream, and a
shutdown reports the session as `gone`; partial messages and subsequent
idle notifications do not become final replies. Further sends report
`unknown` and `start` cannot silently replace the failed session. Reconcile
the project log and session state before explicit recovery.
An uncertain SDK send similarly invalidates the current observation and
reply stream; retrying the same message on that route does not send it again.

The SDK acknowledges *acceptance*, not per-message consumption. Consequently
the adapter reports `queued` followed by `unknown`; it does not claim
`processed` without evidence. A final reply is the last user-facing assistant
message when Copilot reports idle, not each intermediate tool-loop message.
Consumers must persist their own project event preconditions and avoid
resending uncertain operations. Registration rejects unknown or conflicting
local projects; the adapter does not infer a worktree from a route string.
The registry excludes concurrent owners of the same route. If an owner exits
without `close()`, explicitly verify it stopped, then call
`registry.recover(route, { confirmStopped: true })`; recovery refuses a live
owner, another host, or an unknown lock. It does not replay an uncertain send.
The registry also persists the route's Copilot session identity before
creation: a missing SDK listing or an ambiguous creation failure cannot
silently spawn a replacement. Only after verifying that the old session is
truly lost and no route owner is active, call
`registry.forgetSession(route, { confirmLost: true })` to permit a new session.
This does not erase the old session, undo side effects, or authorize retrying
messages with uncertain delivery.

The `silvermoon/agents/project-runtime` subpath exports `ProjectRuntime`.
It resolves the registered project's own installed Silvermoon CLI (or this
source checkout's entrypoint), starts it in a separate process with the
idea worktree as its working directory, and returns its structured report
with `exitCode` (0 for success, 1 for a structured invalid/unavailable report).
Reports with an unexpected command, idea, event operation, or malformed
event receipt are rejected rather than treated as successful capabilities.
`next(route)` calls only that project's `whats-next`; it does not reproduce
Silvermoon's lifecycle rules. `replay(route)` observes the local event log;
`appendInteraction(route, { type, message, expectedLength, expectedDigest })`
passes an exact-log-bound `ping` or `pong` to the project's event command.
For a legacy v1 project, that event command returns a structured unavailable
report (`exitCode: 1`); no v2 event support is inferred from `next(route)`.
Unsupported CLI/report versions, missing installations, and process failures
are explicit errors. The caller still owns the loop, decision authorization,
and the safe correlation of delivery and reply observations.

For an isolated, opt-in live acceptance run (requires an authenticated
Copilot CLI), use
`SILVERMOON_REAL_COPILOT=1 node --test test/integration/copilot-runtime-live.test.js`.
This creates and removes a disposable Git project and idea worktree, denies
tool permissions, and checks two sequential `ping`/reply/`pong` handoffs in
one session. It then restarts the adapter for a third handoff using the
persisted session binding. Normal test runs skip the live case; it does not
establish in-flight disconnect recovery, side-effect deduplication, or Git
repair.

## Public Commands

```sh
silvermoon list-ideas [--state <state>] [--all] [--query <text>] [--created-since <RFC3339>] [--created-before <RFC3339>] [--sort <newest|oldest>] [--limit <positive-integer>] [--language <en|en-US|zh|zh-CN>] [--audience <human|agent>] [--trace <file.trace.jsonl>]
silvermoon whats-next [idea] [--language <en|en-US|zh|zh-CN>] [--audience <human|agent>] [--trace <file.trace.jsonl>]
silvermoon create-idea [--language <tag>] [--audience <human|agent>] [--trace <file.trace.jsonl>]
silvermoon check [--remote | --commit <revision> | --staged | --worktree] [--language <en|en-US|zh|zh-CN>] [--audience <human|agent>] [--trace <file.trace.jsonl>]
silvermoon event <replay|append|revise|recover> [idea] [--input <request.json>] [--expected-length <bytes>] [--expected-digest <sha256>] [--expected-primary <commit>] [--confirm-decision] [--owned-suffix] [--confirm-stopped] [--rollback] [--audience <human|agent>]
```

Every valid invocation starts one ordered domain-message stream with
`intention.accepted`. Observation facts are folded through one immutable
reducer. Side effects are represented by exactly one `action.requested` and
one `action.finished` message with the same run-local action ID. A final
`response.created` message is emitted only after the observation is terminal
and no action is pending.

All successful and trustworthy blocked commands return exactly four
projections:

```json
{
  "intention": {
    "command": "whats-next",
    "args": {
      "idea": null,
      "language": null
    }
  },
  "observation": {
    "outputLanguage": "en-US"
  },
  "actions": [],
  "response": {
    "kind": "choice-required",
    "language": "en-US",
    "summary": "No active ideas are available.",
    "choices": [],
    "nextSteps": []
  }
}
```

- `intention` contains the command and normalized business arguments. For
  `whats-next` and `check`, `args.language` is the canonical temporary output
  override or `null`. For `list-ideas`, args contain the expanded canonical
  state set, normalized UTC bounds, sort, and numeric limit. Output format is
  not part of the intention.
- `observation` describes the reliable facts for the requested command and
  intent, not a mandatory global idea inventory. `outputLanguage` is present
  even when Git, configuration, or a requested snapshot is unavailable.
- `actions` projects only side effects already attempted by this invocation.
  Each item has a unique `id`, stable `type`, `success` or `failure` status,
  and a structured `result` or `problem`. An empty array means no side effect
  was attempted. Probes and future work do not appear here.
- `response` is a command-specific discriminated union produced only from the
  intention and final internal observation. Its variants are `blocked`,
  `choice-required`, `idea-created`, `idea-list`, `next-steps`, and
  `validation-result`, and `event-result`. It contains the localized summary and any ordered
  `nextSteps`, choices, items, validation result, or guidance needed by the
  caller.

After readiness, an actionable selected idea or successful creation may add
content-free `guidance` provenance to the public observation:

```json
{
  "guidance": {
    "phase": "implementing",
    "path": ".silvermoon/guidance/implementing.md",
    "contentRevision": "<git-blob-object-id>"
  }
}
```

The matching `response.guidance` carries the same three provenance fields plus
the captured `content`. All fields come from one Git snapshot, and the object
ID follows the repository's SHA-1 or SHA-256 format. An absent file produces
neither field. The public observation intentionally omits content so the
response is the only rendered payload while still remaining a deterministic
projection.

Audience selection is independent of report construction. When `--audience` is
omitted, the audience is `human`: stdin and stdout must both be TTYs for the
bundled `tui-md` view to start. That view supports scrolling; drag to select
text and press `y` to copy it. On local Windows terminals, the built-in
PowerShell clipboard command is used when the terminal clipboard protocol is
unavailable. Copy feedback temporarily replaces the shortcut hint, using a
muted green for success or amber for problems, then clears after about three
seconds without shifting the document. If copying fails, the
view displays a diagnostic; terminal-native selection may be available with
Shift+drag. Exit with `q`, `Esc`, or `Ctrl+C`.
The TUI document uses the available terminal width rather than a fixed
100-column limit. Tables that fit the view measure Chinese characters by
terminal cells so wide screens do not wrap otherwise-fitting columns; tables
too wide for the screen retain horizontal navigation.
If either stream is not a TTY, human output is raw
Markdown. `--audience agent` always emits raw Markdown without TUI control
sequences. On Windows, TUI frames use Node's terminal stream for UTF-8 output
without changing the console code page. Both Markdown paths render only
`response`, never the intention, observation, or action history, and derive their
content from the same command report. They begin with the answer, then include
only relevant idea references,
inventory details, validation details, problems, next steps, and blockquoted
guidance. Text reports render problems as a Markdown table. `list-ideas` and
`whats-next` active choices use the same `Alias / ID`, state, created, title
columns: an alias replaces the ID in that column when present. Structured
dates in these lists and any displayed creation-time filter bounds are short
relative times (just now, minutes, hours, days); after seven days they show a
local calendar date without a time.
Future dates are labelled as upcoming, not as elapsed. JSON retains exact
UTC timestamps and all filtering still uses the exact values.

`--json` without an explicitly selected audience serializes the four
projections from the same domain stream; explicit `--json --audience ...` is a
usage error. There is no YAML output or second reasoning path. A trustworthy
blocked report still exits `0` for `whats-next` and `create-idea`.
`list-ideas` exits `0` only for a trustworthy inventory (including an empty
result) and exits `1` for setup or layout unavailability. `check` exits `0`
only for a valid snapshot and otherwise exits `1`. Internal failures also exit
`1`; invalid CLI usage exits `2`.

All commands accept `--trace <file.trace.jsonl>`. If the supplied path does not
end with the exact lowercase `.trace.jsonl` suffix, Silvermoon appends it while
preserving the directory and original name. Repository-local `*.trace.jsonl`
files are ignored by the canonical repository. The trace is newline-delimited
JSON using trace schema version 2. Every record shares one `traceId`, global
monotonic `sequence`, and UTC timestamp:

- `channel: "domain"` records allowlisted summaries of intention,
  observation transitions, action lifecycle, and response metadata. It
  includes domain `messageSequence` for replay correlation.
- `channel: "telemetry"` records paired `span-start` and `span-end` events,
  parent span IDs, monotonic `durationMs`, and success or error status.

The root `command.*` span starts after Commander has parsed the invocation and
covers domain dispatch through JSON or Markdown output. Its safe attributes
identify the renderer; executable invocations also include the monotonic
`bootstrapDurationMs` from process entry through dispatch. Non-interactive
output has a child `output.render` span. Human TUI rendering remains outside
the command span so waiting for input is not reported as automated command
work.

Action telemetry carries the corresponding action ID. All production
subprocesses use the trace-aware runner. Git subprocesses emit `git.command`
with only the subcommand, argument count, network classification, exit code,
and signal; neither Git arguments nor process input or output are recorded.
Trace projection never includes guidance or file content, environment data,
credentials, tokens, or unbounded error text. Turning trace off, replacing the
domain sink with a no-op, or deleting every telemetry event does not change the
domain stream or final report.

The path is relative to the caller's working directory when not absolute.
Events are buffered so a trace inside the repository cannot affect that
invocation's worktree observation. After the command span ends, a root
`trace.flush` span covers exclusive file creation and the durable write of all
preceding events; its final span-end record is appended as the trace trailer.
Flush and close failures are returned as command errors. An existing normalized
target is never overwritten.

### Reproducible performance traces

Performance comparisons use a disposable clean clone pinned to one commit and
tree on the same machine and storage volume. When a command needs the primary,
map the canonical primary URL to a local bare repository with Git `insteadOf`;
do not replace the configured URL or skip the command's normal fetch. Prove the
clone clean before and after every sample. For `create-idea`, remove only the
exact idea path returned by that sample, then prove the clone clean again.

Benchmark this matrix: default and `--all` inventory; bare and selected aligned
navigation; creation; and HEAD, staged, worktree, and remote checks. Run one
unrecorded warm-up followed by five independent JSON invocations with unique
trace files. Retain every measured sample rather than removing network, cache,
or timing outliers.

Use the matching `command.*` span-end duration as total command work. Network
duration is the sum of child `git.command` span-end durations whose safe
`network` attribute is `true`; subtract that sum from each individual total
before calculating a non-network median. Report all five totals, all five
network/non-network decompositions where applicable, median, minimum, maximum,
Git process count, `snapshot.materialize*` count, and inventory candidate/title
read counts. Keep raw traces outside the measured repository.

Unsupported output locales, empty values, invalid BCP 47 tags, and invalid
`list-ideas` filters are usage errors with exit status `2`, before repository
inspection, trace creation, or fetch.

Observations are discriminated by command intent and `state`:

- `project-setup-required` uses `observedThrough` (`root`, `version`,
  `configuration`, or `ideas`) to identify the deepest reliable cumulative
  shape. Fields beyond that boundary are absent rather than null or fabricated.
- `repository-sync-required` is used by `whats-next` and always includes
  `root`, `version`, `configuration`, `ideas`, and at least one `problem`.
- `repository-preparation-required` is used by `create-idea` when its local
  safety checks fail. It includes `root`, `version`, `configuration`, and at
  least one `problem`, but no idea inventory or remote synchronization facts.
- Bare `whats-next` returns `navigation-ready` with `ideas.counts` and
  `ideas.activeIdeas` (possibly empty). Each active item includes `id`,
  lifecycle `state`, UTC `createdAt`, and optional alias/title read from the
  current idea document; missing titles render as `-`. It never selects a
  candidate.
- Selected `whats-next` returns `idea-selected` with only `selectedIdea`
  (`id`, optional `alias`, lifecycle `state`), including terminal ideas.
  Unknown selectors return `idea-not-found` with the same enriched active
  `candidates`, not a fabricated selected idea. An actionable selection may
  also contain snapshot-bound guidance provenance; captured content is in
  the response.
- `phase-guidance-invalid` means command readiness reached the current
  actionable phase, but that phase's optional file exists and is invalid. It
  contains problems and repair instructions, not lifecycle instructions or
  guidance content.
- After a successful `create-idea` preflight, `idea-created` carries
  `createdIdea` (`id`, `path`, `state: "preparing"`). This confirms
  pre-creation readiness, not a clean post-creation worktree, and may also
  contain preparing-guidance provenance. An attempted but failed scaffold
  returns `idea-create-failed` without `createdIdea`, records separate
  scaffold and cleanup actions, and exposes cleanup facts; preflight failures
  retain their setup or local preparation state.
- Successful `list-ideas` returns `ideas-listed`. Its observation contains the
  normalized snapshot facts, all-five-state counts for the filtered set,
  matched/returned/truncated totals, and ordered items with ID, lifecycle
  state, UTC `createdAt`, and optional alias/title. Its empty `actions` and
  `idea-list` response are deterministic projections of the same command run.
  Setup or layout failures remain cumulative `project-setup-required`
  observations and never return a partial inventory.

Dialogue versions have `version.type: "worktree"`. When present, `ideas.counts` has
`preparing`, `implementing`, `deploying`, `completed`, and `abandoned`;
`activeIdeas` contains only minimal references for the first three states
outside navigation; navigation enriches those references after readiness.
Problems have only stable `type` and natural-language `summary`; remediation
belongs in `response.nextSteps`.

Project setup is ecosystem-neutral. It checks Git, configuration schema
compatibility, and canonical skill content at `.agents/skills/silvermoon`.
CRLF and LF are equivalent for valid UTF-8 skill text so Git checkout settings
cannot create false drift; filenames and every other content change remain
exact. The check does not inspect execution source or require a package manager,
`package.json`, project-local Silvermoon dependency, or `node_modules`.

`whats-next` checks local conflicts and changes before remote access, then HEAD
and upstream identity, then fetch and ancestry. A local branch may have any
name, but its upstream must identify the configured repository and primary
branch. Change summaries have fixed item and UTF-8 byte budgets and provide
full counts and omitted counts; instructions require inspection of the complete
change set without prescribing a particular diff tool. Bare navigation
never selects an idea: it always lists every active idea alongside the option
to discuss and run `create-idea`.

`create-idea` requires the configured primary branch and upstream plus a clean
worktree, validates optional preparing guidance from the same local `HEAD`,
then creates one canonical scaffold. It does not fetch, compare remote
ancestry, or require local HEAD to match the remote tip. Its optional
content-language choice accepts any canonical BCP 47 tag, is normalized before
preflight, and is persisted to the new idea; without it the status remains
dynamically inherited. It does not stage, commit, push, or record approval.

`list-ideas` is a local worktree query, not lifecycle navigation. With no
filters it selects the three active states. Repeated `--state` values form a
deduplicated union and `active` expands to those states; `--all` selects all
five states and is mutually exclusive with `--state`. Case-insensitive literal
`--query` matches ID, alias, or the first level-one `Idea.md` heading. RFC 3339
creation bounds use `[created-since, created-before)` against the timestamp
encoded in each ULID. Sorting defaults to stable newest-first, and limit is
applied after filtering and sorting without changing matched counts.

The query validates Git presence, configuration, canonical skill, and the
complete idea layout before filtering. It reads staged, unstaged, and
untracked idea changes from the current worktree snapshot but never checks
worktree hygiene, branch, upstream, or primary ancestry, and never fetches or
accesses the network. `list-ideas --language <en|en-US|zh|zh-CN>` overrides only
Silvermoon-owned output for that invocation; without it, the project's
resolved output language is used.

## Validation Targets

- `check` validates only the committed `HEAD` snapshot. It is not a
  pre-commit check.
- `check --worktree` validates the hypothetical commit formed from `HEAD`, the
  index, unstaged changes, and nonignored untracked files.
- `check --staged` validates the index snapshot for a pre-commit hook.
- `check --commit <revision>` validates one local commit and its first-parent
  event boundary, without walking older commits.
- `check --remote` fetches primary using committed coordinates and validates its
  tip and its immediate event boundary for v2. Unrelated skill
  or idea findings in local `HEAD` do not block
  locating and validating the remote snapshot.

Targets are mutually exclusive and never change the caller's branch, index, or
worktree. `--remote` may fetch Git objects and records that attempt as an
action. `check` validates the selected snapshot's project contract:
Git, configuration, canonical skill, idea layout, world revisions, status, and
the complete optional phase guidance directory.
For v1 its result depends on the materialized tree, not commit parents, parent
order, branch, merge/cherry-pick path, or retained decision reachability. A canonical
decision revision that differs from the current world is a valid historical
fact and naturally derives an earlier lifecycle state; it need not still exist
in the local object database. `check` does not check local worktree cleanliness,
upstream, or ancestry readiness, route ideas, or give next-step instructions.
V2 additionally reports `validation.eventHistory`: the fixed primary reference,
the selected commit's first parent when applicable, and the current
initialization/migration/append/repair boundary. Local targets use named primary
tracking refs without fetching; unavailable or conflicting refs fail closed.
Normal checks do not audit earlier commits; use `check --commit <revision>` to
inspect a specific historical boundary. History rules depend on each
base's complete reduction, not the candidate's failure: `ok: true` requires
its exact byte prefix; definite `ok: false` permits a valid complete repair.
Missing/invalidly encoded history never grants repair permission.
The immediate predecessor prevents downgrading a v2 project to v1;
genuine v1 historical snapshots remain readable without auditing their decisions.

Like every public command, `check --json` contains all four projections:

```json
{
  "intention": {
    "command": "check",
    "args": {
      "target": { "type": "staged" },
      "language": null
    }
  },
  "observation": {
    "state": "project-ready",
    "root": "D:\\Code\\silvermoon",
    "version": { "type": "staged" },
    "outputLanguage": "en-US",
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
  },
  "actions": [],
  "response": {
    "kind": "validation-result",
    "language": "en-US",
    "summary": "The requested Silvermoon snapshot is valid.",
    "validation": {
      "target": { "type": "staged" },
      "valid": true,
      "version": { "type": "staged" }
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

`--language en|en-US|zh|zh-CN` is orthogonal to every target. It changes only
Silvermoon-owned natural-language framing and leaves the target, snapshot,
validation state, problems, and exit status unchanged.

The `check` observation has its own discriminated states:

- `project-ready` has root, version, resolved configuration, idea summary,
  and empty problems. It says nothing about repository synchronization.
- `project-setup-required` has nonempty problems and the same progressive
  `observedThrough` variants as project setup in the dialogue.
- `check-unavailable` has known root, target version, and nonempty problems
  when the target cannot be resolved, fetched, or materialized; it does not
  pretend the project was checked.

Its default human-readable output renders only the validation response. Text
and JSON derive from the same validation result. `actions` is empty for local
targets and contains the paired fetch result for `--remote`. Exit code `0`
means `project-ready` and is the **only** pre-commit/CI pass condition. Exit
code `1` means invalid, unavailable, or an internal failure and must fail
closed; `2` means invalid CLI usage. Do not infer success merely from a
rendered report or empty-looking output.

Runtime checks verify canonical YAML, fixed paths, the three world entries,
unique aliases, Git object format, current world tree resolution, phase
guidance structure and content, and lifecycle derivation from the selected
snapshot. V2 also checks its state-event transitions and primary history, but
neither format treats a Git diff as proof of human authorization.

## Schemas

- [Command report](../schema/v1/command-report.schema.json)
- [Domain message](../schema/v1/domain-message.schema.json)
- [Repository configuration](../schema/v1/config.schema.json)
- [Event project configuration](../schema/v2/config.schema.json)
- [Idea state event](../schema/v2/idea-event.schema.json)
- [User configuration](../schema/v1/user-config.schema.json)
- [Idea status](../schema/v1/idea-status.schema.json)
- [Shared definitions](../schema/v1/definitions.schema.json)
- [Unified trace event](../schema/v2/trace-event.schema.json)

Phase guidance has no schema or configuration key. Its fixed filenames,
Git-entry constraints, and Markdown byte rules are the complete contract.
