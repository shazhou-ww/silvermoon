# Ledger

## Implementation

### Implementation steps

- [x] **I-S01:** Normalize trace output names
- [x] **I-S02:** Snapshot idea worlds once
- [x] **I-S03:** Observe primary through one fetch
- [x] **I-S04:** Prove equivalence and performance

### Implementation acceptance criteria

- [x] **I-AC01:** Trace files follow one ignored naming convention
- [x] **I-AC02:** Idea layout uses a constant Git process budget
- [x] **I-AC03:** Primary observation uses one network command
- [x] **I-AC04:** Measured latency and compatibility targets pass

Trace evidence: `git-observation-before.trace.jsonl` recorded 241 layout Git
commands and 26232.359ms; `git-observation-after.trace.jsonl` recorded four
layout Git commands and 574.807ms, a 97.81% reduction. Passing tests cover
14-idea constant command count, immutable snapshots, one network fetch,
SHA-256, trace suffix normalization, ignore scope, and exclusive creation.
`pnpm check` passed with 71 integration tests and no failures, plus package
contents, installed-package smoke, and skill synchronization.

## Deployment

### Deployment steps

- [ ] **D-S01:** Step title

### Deployment acceptance criteria

- [ ] **D-AC01:** Criterion title
