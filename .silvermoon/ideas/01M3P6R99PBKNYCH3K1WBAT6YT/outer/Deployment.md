# Deployment

## Steps

### D-S01: Publish the repository verification contract

Publish this deployment contract to the configured primary branch through
ordinary non-force Git. This deployment has no package-release action: do not
publish npm, create an npm release tag, or invoke the npm publishing workflow.

### D-S02: Validate the published primary snapshot

Refresh the configured primary branch, prove that the published deployment
candidate is reachable from it, and run Silvermoon validation against the
remote snapshot. Run the repository's complete `pnpm check` suite against the
same candidate.

### D-S03: Verify the real default navigation output

Run the repository CLI's default bare `whats-next` command from the clean,
synchronized repository. Confirm that its human-readable output includes the
exact `navigation-ready` state while the JSON form continues to report
`observation.state` as `navigation-ready`.

## Acceptance criteria

### D-AC01: Primary contains the verified candidate

The deployment contract and accepted implementation are reachable from the
refreshed `origin/main` tip. `silvermoon check --remote --json` reports a valid
remote snapshot at that commit.

### D-AC02: Repository release-grade checks pass

`pnpm check` exits successfully for the published candidate, proving its unit,
integration, contract, end-to-end, skill, Markdown, and package checks without
publishing a package.

### D-AC03: Agent setup has an observable ready boundary

Default bare `whats-next` output includes `navigation-ready`, and the matching
JSON report has `observation.state: navigation-ready`. Captured command results
in the ledger prove both views agree.

### D-AC04: Deployment performs no npm release

The deployment evidence contains only repository publication and verification:
no npm package publication, npm release tag, or npm publishing workflow is
created or invoked.
