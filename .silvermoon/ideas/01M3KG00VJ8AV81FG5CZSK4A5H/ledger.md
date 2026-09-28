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

- [ ] **D-S01:** Step title

### Deployment acceptance criteria

- [ ] **D-AC01:** Criterion title
