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

- [x] **D-S01:** Establish the exact primary deployment
- [x] **D-S02:** Verify optimized behavior from a clean clone

### Deployment acceptance criteria

- [x] **D-AC01:** Primary contains the accepted performance implementation
- [x] **D-AC02:** Published source reproduces the optimized observation

Primary proof: `origin/main` resolved to
`bae91edfe778a259a4520473f6a2f0013c77a15e`; clean-clone ancestry checks
confirmed implementation commit `7f6d202f7d3937a1ecbf2a0e4d42ef1bc65b06e7`
and acceptance commit `14ac4b6cbe5e62accc0a724c110a9603492ce982`.
Clean-clone proof: locked installation succeeded, focused tests passed 28/28,
and `check --remote` validated the exact primary tip. A real tracking-branch
`whats-next --trace deployment-proof` created the ignored
`deployment-proof.trace.jsonl`, recorded four layout Git commands and one
network `fetch`, and left `git status --porcelain` empty. The clone was removed.
