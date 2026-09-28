# Ledger

## Implementation

### Implementation steps

- [x] **I-S01:** Simplify snapshot target orchestration
- [x] **I-S02:** Derive lifecycle only from snapshot facts
- [x] **I-S03:** Cover topology-independent target behavior
- [x] **I-S04:** Align operator documentation

### Implementation acceptance criteria

- [x] **I-AC01:** Equivalent trees produce equivalent project results
- [x] **I-AC02:** Historical revision facts need no retained object
- [x] **I-AC03:** Ordinary checks do not inspect transitions or provenance
- [x] **I-AC04:** Existing snapshot validation remains compatible

Targeted proof: `node --test test/integration/check-v1.test.js
test/integration/idea-layout.test.js test/integration/git.test.js` passed 24/24.
Repository proof: `pnpm check` passed, including 67 integration tests with no
failures, package-content checks, installed-package smoke tests, and skill sync.

## Deployment

### Deployment steps

- [x] **D-S01:** Establish the exact primary deployment
- [x] **D-S02:** Verify behavior from a clean clone

### Deployment acceptance criteria

- [x] **D-AC01:** Primary contains the accepted implementation
- [x] **D-AC02:** Published source reproduces snapshot-only validation

Primary proof: `origin/main` resolved to
`12e52b3815f67e548e9f72c8a13dd779bdf41747`; clean-clone ancestry checks
confirmed implementation commit `1aba5d0c27f66187e24819d5d5c33a6d6bc2e0fb`
and acceptance commit `a5b1f82505ac05441575f48d10074b24a4a1e4c6`.
Clean-clone proof: locked dependency installation succeeded, targeted integration
tests passed 24/24, and `node bin/silvermoon.js check --remote` validated that
exact primary tip as project-ready. The temporary clone was removed afterward.
