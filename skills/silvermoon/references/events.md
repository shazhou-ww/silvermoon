# Event-backed projects

These rules apply when `.silvermoon/config.yaml` has `version: 2`.
V1 projects remain readable and use their existing canonical `status.yaml`.
Never change the version alone or migrate a project implicitly.

## Storage and state

V2 replaces each idea's `status.yaml` with `events.jsonl`; never keep both.
An empty file is the identity-only initial state, not a missing file.
Identity comes from the ULID directory. Events are canonical UTF-8 JSONL
without BOM, with LF and a final LF for nonempty logs. Do not let Git convert
these bytes: add `**/events.jsonl -text` to the project's `.gitattributes`.

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

The receipt gives exact byte `length`, SHA-256 `digest`, the reduction result,
and a local primary tracking commit explicitly marked **not fetched**.
Refresh the configured named remote before relying on that baseline. A
missing/ambiguous tracking ref blocks rather than choosing an arbitrary base.
Use the exact ULID if invalid logs prevent alias resolution.

Put a business request in a JSON file, without sequence, for example:

```json
{"type":"setAlias","payload":{"alias":"event-state-model"}}
```

For metadata and human decisions, bind the request to the observed log and
primary:

```sh
silvermoon event append <idea> --input request.json --expected-length <bytes> --expected-digest <sha256> --expected-primary <commit> --audience agent
```

The writer fetches primary, verifies the request, validates the entire project,
acquires an exclusive project transaction, rechecks the source and world
snapshot, refreshes primary again, and atomically replaces the log. The commit
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
original prefix and exact record. A stale request with another record at that
position is a conflict, not permission to renumber. Two metadata edits are two
requests; if the second fails, the first remains a completed local append.

## Check and revise

V2 `check` validates both the chosen snapshot and primary event history:

- Worktree/index candidates use a fixed local named-primary tracking commit;
  local checks never fetch or claim remote freshness.
- Unintegrated commits use that primary. Fast-forward candidates must also
  have valid transitions along their prospective primary first-parent chain.
- Already-integrated first-parent commits are audited against their historical
  primary predecessor. `--remote` fetches the primary tip and audits it.
- Each idea is independent: successful base reduction requires an exact byte
  prefix; definite `ok: false` allows a complete valid repair. Parse errors,
  missing objects and shallow missing parents do not grant repair permission.
- Valid repair/migration/initialization boundaries stop older audit for that
  idea. Repair is reported as repair, not append-only. The repaired log
  immediately becomes protected again; another idea receives no exemption.

Keep unknown work. Sync and reassess intent and ownership before revising an
unintegrated suffix. Save a JSON array of the complete desired business
requests (without sequence), then run:

```sh
silvermoon event revise <ULID> --input reviewed-requests.json --owned-suffix --expected-length <bytes> --expected-digest <sha256> --expected-primary <commit> --audience agent
```

`--owned-suffix` asserts that the replacement has been reviewed and is yours
to revise. The CLI assigns sequences and enforces the primary prefix or
definite failed-base repair rule. Newly introduced decisions still require
their human gate. It never automatically discards unknown candidates.

After local committed candidates have been revised, preserve their history.
If their intermediate transitions cannot fast-forward legally, integrate
through an ordinary merge with current primary as first parent. Never force,
reset, or rebase away those candidates to conceal the conflict.

An integration gate must refresh primary and bind the reported baseline to
the actual old tip being updated. Primary movement requires rechecking.
The CLI cannot substitute for a server-side required gate or distributed lock.

## Interrupted writes

`.silvermoon/transaction` is a complete recovery plan and exclusive lock, not
business state; it stores original and candidate bytes. Normal commands block
while it exists. Never commit it or `.pending`/`.prepared` temporary files.
Do not delete a lock by age.

After confirming the original writer has stopped:

```sh
silvermoon event recover --confirm-stopped --audience agent
silvermoon event recover --confirm-stopped --rollback --audience agent
```

Recovery refuses active/reused PIDs, foreign hosts, unknown bytes and a changed
plan. Resume revalidates primary and worlds for lifecycle writes, or the
complete candidate log for local interaction writes; rollback restores only exact
operation-owned bytes. A second recovery is excluded by `transaction.recovery`.
If a recovery process itself is killed, stop all recovery participants, verify
its recorded PID is inactive and inspect the original plan, then explicitly
remove only that recovery mutex before retrying. The tool never guesses it is
stale or removes it automatically. Preserve unexpected files for investigation. Files are
fsynced before same-directory rename. POSIX directory entries are also synced;
Node on Windows provides no directory-fsync guarantee, so power-loss durability
depends on the filesystem. Process-interruption recovery does not imply a
hardware power-loss guarantee.

## Source checkout's internal format conversion

The Silvermoon source repository itself contains earlier, unpublished v2
dot-separated event records. Its one-time internal conversion is not a public
v2-to-v3 migration or a compatibility promise to other projects. Only in that
source checkout, after explicitly scheduling the conversion, use the bundled
standalone entrypoint:

```sh
node bin/migrate-internal-events.js --root <source-checkout>
node bin/migrate-internal-events.js --root <source-checkout> --apply --expected-digest <plan-digest>
```

The read-only plan checks all old logs against the named primary, exact type
renames, equivalent fact projections, and the abandoned-window rule. Apply
rechecks primary and requires a clean committed source. The recoverable
transaction converts every source idea log and records an internal historical
format boundary while leaving project `version: 2` unchanged. Prior Git
commits remain readable as old format; subsequent records must satisfy the
final public v2 schema and append-only history. This does not authorize an
upgrade of another repository or an implicit migration. Validate, commit
and synchronize normally; never hand-edit JSONL. For interrupted transactions,
after confirming the original writer has stopped:

```sh
node bin/migrate-internal-events.js --root <source-checkout> --resume --confirm-stopped
node bin/migrate-internal-events.js --root <source-checkout> --rollback --confirm-stopped
```

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
