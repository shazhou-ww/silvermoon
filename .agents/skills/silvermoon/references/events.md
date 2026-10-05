# Event-backed projects

These rules apply when `.silvermoon/config.yaml` has `version: 2`.
V1 projects remain readable and use their existing canonical `status.yaml`.
Never change the version alone or migrate a project implicitly.

## Storage and state

V2 replaces each idea's `status.yaml` with an `events/` folder; never keep both.
Segments are named `0000000000000001.jsonl`, `0000000000000002.jsonl`, and so
on, using consecutive 16-digit positive ordinals. Each holds at most **1000**
records; every non-tail segment must be full. Full segments are sealed;
append to the partial tail or create the next segment. An empty first segment
is the identity-only initial state. Do not create an empty trailing segment
after a full segment. Date boundaries never split a logical stream or session,
and event sequences do not restart.
Identity comes from the ULID directory. Events are canonical UTF-8 JSONL
without BOM, with LF and a final LF for nonempty logs. Do not let Git convert
these bytes: add `**/events/*.jsonl -text -filter` to the project's `.gitattributes`.
A record including LF is limited to 1048576 bytes; this is a byte limit, not
a character limit. Oversized records are explicit errors, not truncated messages.

The stream HEAD is the **events folder's** normalized Git tree digest, not
the repository HEAD, a commit, the entire repository tree, one sequence, or
the tail segment alone. Hash raw segment bytes as Git blobs and encode their
ordered canonical names with fixed `100644` modes in a Git tree. Use the
repository's SHA-1/SHA-256 object format, just like world revisions. Locks,
`.pending`/`.prepared` temporary files, `checkpoint.json`, `cursor.json`,
permissions and mtime are excluded; unknown or irregular entries are errors.
Do not trust checkpoint/cursor contents as facts or authorization.

Verified immutable snapshots reuse sealed blob digests and hash only the
changed tail plus the segment table. Immutable Git snapshots can calculate
the normalized folder digest from their object table without loading segment
bodies. Full event replay, reduction validation and filesystem integrity audits
still read history; do not describe these as constant-time operations.

Every record has a consecutive positive safe-integer `sequence` and `type`.
V2 defines seven business changes and two interaction messages:

| Type | Payload |
| --- | --- |
| `setAlias` | `{"alias":"unique-name"}` or `{"alias":null}` |
| `setLanguage` | `{"language":"zh-CN"}` or `{"language":null}` |
| `acceptIdeal` | `{"idealRevision":"<exact world tree OID>"}` |
| `acceptInner` | `{"implementationRevision":"<exact world tree OID>"}` |
| `acceptOuter` | `{"deploymentRevision":"<exact world tree OID>"}` |
| `abandon` | No payload |
| `resume` | No payload |
| `ping` | `{"message":"nonempty string"}` |
| `pong` | `{"message":"nonempty string"}` |

Interaction messages occupy the same sequence
and log as business events. Replay adds `interaction.messages` (ordered
`sequence`, `type`, `message`) and `interaction.lastSignal` (`ping`, `pong`,
or `null`). Only `ping` and `pong` change the last signal; neither represents
completion or clears a previous goal. Consecutive `pong` events, including
without a prior `ping`, are valid. After `abandon`, only `resume` is valid.
The sender convention is upstream for decisions, `abandon`, `resume`, `ping`;
downstream for `pong`; and both for metadata. The stateless CLI does not
authenticate senders or reject messages based on the last signal.

No timestamps, actors, repository commits, IDs, observations, imports,
creation, arbitrary patches, or decision retractions belong in a record.
Null clears only alias/language. Identical state changes are not appended.
The last decision for each field is compared to current nested world trees
using the existing five-state algorithm. Queries never write observations.
Change meaningful world content when requirements or results change; do not
clear approval to reset the lifecycle.

## Observe and append

Use the project-version CLI, not hand-edited JSONL. In Silvermoon's source
checkout, replace `silvermoon` below with `node bin/silvermoon.js`.

```sh
silvermoon event replay <idea> --audience agent
```

The receipt gives exact logical byte `length`, events-folder Git tree `digest`, the reduction result,
and a local primary tracking commit explicitly marked **not fetched**.
Refresh the configured named remote before relying on that baseline. A
missing/ambiguous tracking ref blocks rather than choosing an arbitrary base.

After a full replay, consumers may use its exact `{ length, digest }` cursor
to query only subsequent events:

```sh
silvermoon event replay <ULID> --after-length <bytes> --after-digest <oid> --audience agent
```

This additive query requires the canonical ULID and both cursor fields.
`delta-observed` returns the ordered `events`, current `length`, `digest` and
`sequence`, and the original cursor in `after`. It intentionally returns no
complete `reduction` or whole-history validity assertion. The consumer must
already have processed the cursor's prefix; advance its saved cursor only
after processing the returned events successfully. No new events means an
empty array. A changed/deleted prefix or a non-record byte boundary is an
explicit error, never an automatic cursor reset. A cursor is not a checkpoint,
session boundary, approval, append authorization, or successful SDK delivery.
Full replay remains available and unchanged for initialization and audits.
The query reuses sealed Git blob OIDs and reads only the boundary/suffix
segments. On POSIX, cursor queries and canonical-ULID interaction appends
reuse a private copy of the current index's verified content OIDs. Precise
ctime/mtime nanoseconds invalidate changed entries, including restored-mtime
edits; sources are rechecked after snapshot acquisition. Assume-unchanged,
skip-worktree, fsmonitor and weakened stat settings cannot conceal edits.
Coarse timestamp entries retain full content verification. Windows uses
authenticated native ChangeTime records bound to the corresponding Git OID
and runtime instead of comparing Node ChangeTime with Git CreationTime;
missing or changed records force content verification.
Other snapshot consumers keep their previous full-validation behavior.

For canonical-ULID `ping`/`pong` appends, the project runtime may persist a
disposable authenticated sealed-prefix projection under a worktree-specific
Git-private `silvermoon-event-cache/` directory. It contains only reduced
status, sequence and last signal, never messages or new facts. A local
private key authenticates the runtime-produced summary; its context binds
the idea, exact prefix Git digest and relevant runtime source identity.
Cold or changed prefixes are rebuilt from canonical events, while a warm
match reads only the tail. An unauthenticated or irregular cache is an
explicit error, never a successful fallback or permission to append.
The private key and derived files must never be committed or shared.
These are not security guarantees against a local user who can replace
both the runtime and its key.

The authenticated projection is neither an independent state authority nor
a human decision. Complete replay, historical audits, migration/repair boundaries
and recovery remain available and perform full validation. Alias interaction
appends retain complete alias/layout resolution with authenticated projections.
Default segmented V2 metadata append receipts use `history.detail: "summary"`
with exact base/candidate lengths, folder digests and sequences, not complete
message arrays. They validate every project's current projection and the exact
immutable primary prefix; lifecycle gates still require the exact synchronized
world and explicit human decision. Use `--full-history` on append to retain the
complete historical reduction receipt. Version/storage transitions and
definitely reduction-failed primary repair use the existing complete checks.
No format error, cache failure or unknown source enables repair. All appends still
verify the complete folder HEAD before and after the recoverable transaction,
and retries still require the exact record after their original prefix.
Use the exact ULID if invalid logs prevent alias resolution.

Put a business request in a JSON file, without sequence, for example:

```json
{"type":"setAlias","payload":{"alias":"event-state-model"}}
```

For metadata and human decisions, bind the request to the observed log and
primary:

```sh
silvermoon event append <idea> --input request.json --expected-length <bytes> --expected-digest <oid> --expected-primary <commit> --audience agent
```

The writer fetches primary, verifies the request, validates the entire project,
acquires an exclusive project transaction, rechecks the source and world
snapshot, refreshes primary again, and writes only changed segments through a
recoverable transaction. Project commands block while the transaction exists;
cross-segment writes have no successful receipt until the complete stream has
been validated. Raw filesystem readers must honor this transaction boundary.
The commit
is an external write precondition, never event data. Cooperating writers
cannot write the same position; unexpected external edits block recovery.
Do not concurrently hand-edit a target while its CLI transaction runs.

For `ping`/`pong`, supply a request of the form
`{"type":"pong","payload":{"message":"blocked"}}` to the same `event append`
command, but pass only `--expected-length` and `--expected-digest` (no
`--expected-primary`). The local write does not fetch, commit, or require a
clean worktree. If the exact full observed log has changed, reobserve before
responding. A local message is not synchronized to primary merely because
it was appended.

Only after an explicit human decision, add `--confirm-decision` for approval,
acceptance, abandonment or resumption. This flag asserts authorization; it
does not manufacture or prove it. Approvals/acceptances also require the
correct lifecycle phase and exact world tree already on primary. Keep the
review-and-synchronization human gate from the main skill.

Receipts distinguish `candidate-written`, `already-present` and
`no-state-change`; none means integrated into primary. Retries recognize the
original prefix folder digest and exact record. Equal HEADs prove the same
pre-state, not the same request. A stale request with another record at that
position is a conflict, not permission to renumber. Two metadata edits are two
requests; if the second fails, the first remains a completed local append.

## Check and maintain exceptional history

V2 `check` validates the chosen snapshot against its immediate event boundary:

- Worktree/index candidates use a fixed local named-primary tracking commit;
  local checks never fetch or claim remote freshness.
- Worktree/index candidates compare against primary. A committed target
  compares against its first parent; `--remote` fetches the primary tip and
  checks only that commit's boundary. Use `check --commit <revision>` for a
  specific older commit. Normal navigation does not walk committed history.
- Each idea is independent: successful base reduction requires an exact byte
  prefix; definite `ok: false` allows a complete valid repair. Parse errors,
  missing objects and shallow missing parents do not grant repair permission.
- Repair is reported as repair, not append-only. The repaired log
  immediately becomes protected again; another idea receives no exemption.

Keep unknown work. Sync and reassess intent and ownership before maintaining an
unintegrated suffix or a definite reduction-failed primary history. There is no
revision command. Review and edit the complete idea `events/` folder directly:
preserve canonical segment names, exact sequence, the 1000-record boundary,
known decisions, and all unrelated bytes. Never edit only a projected cache or
cursor.

Run `check --worktree` on the complete candidate, inspect the Git diff, stage
only the reviewed event folder, then run `check --staged`. Newly introduced
decisions still require their human gate. Commit and integrate with ordinary
non-force Git; never reset, force-push, or rebase away unknown candidates.

An integration gate must refresh primary and bind the reported baseline to
the actual old tip being updated. Primary movement requires rechecking.
The CLI cannot substitute for a server-side required gate or distributed lock.

## Interrupted writes

`.silvermoon/transaction` is a complete recovery plan and exclusive lock, not
business state; it stores original and candidate bytes. Normal commands block
while it exists. Never commit it or `.pending`/`.prepared` temporary files.
Do not delete a lock by age.

After confirming the original writer has stopped, inspect the transaction plan,
original bytes, candidate bytes, host and PID. There is no event recovery
command. Directly restore or complete the exact operation-owned `events/`
folder bytes, preserve every unknown byte, and remove transaction-owned
temporary files only after the selected complete state matches the plan.
Then run worktree and staged checks before committing.

If maintenance itself is interrupted, stop all participants, verify the
recorded PID is inactive and inspect the original plan, then explicitly
remove only that recovery mutex before retrying. The tool never guesses it is
stale or removes it automatically. Preserve unexpected files for investigation. Files are
fsynced before same-directory rename. POSIX directory entries are also synced;
Node on Windows provides no directory-fsync guarantee, so power-loss durability
depends on the filesystem. Process-interruption recovery does not imply a
hardware power-loss guarantee.

## Explicit v1-to-v2 migration

Migration is not a Silvermoon subcommand. Run the bundled
`bin/migrate-v1-to-v2.js` with Node only after explicit project-upgrade
authorization. In this source repository use the local entrypoint:

```sh
node bin/migrate-v1-to-v2.js --root <project>
node bin/migrate-v1-to-v2.js --root <project> --apply --expected-digest <plan-digest>
```

The first invocation is read-only. Apply requires the same plan digest and a
clean committed source. All ideas and project format change together through
the recoverable transaction. It preserves every known fact, identity, world
and ledger, including old or incomplete decisions. Fixed event order is a
representation order, not invented historical chronology. No-field sources
produce empty logs. Ordinary commands and installation never migrate.

Recovery uses the separate entrypoint:

```sh
node bin/migrate-v1-to-v2.js --root <project> --resume --confirm-stopped
node bin/migrate-v1-to-v2.js --root <project> --rollback --confirm-stopped
```

Changed source/candidate bytes block rather than overwrite. A completed v2
project is detected without appending again. Do not downgrade or roll back
after accepting new facts. Validate and integrate the exact migration boundary
before adding new events; history checks compare it with the original primary
v1 facts. Migration never commits, pushes, approves, or publishes a package.
