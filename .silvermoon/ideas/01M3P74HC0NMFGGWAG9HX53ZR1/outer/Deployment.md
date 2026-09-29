# Deployment

## Steps

### D-S01: Verify the published repository candidate

After this deployment contract is published, refresh `origin/main` and verify
the accepted implementation from the primary branch. Run the complete
repository check, validate the remote Silvermoon snapshot, and exercise the
default human-readable `whats-next` output to confirm that Active ideas is
rendered as an ID/Alias/State Markdown table.

This deployment ends with repository verification. It must not publish an npm
package, create a release tag, or invoke the npm publishing workflow.

## Acceptance criteria

### D-AC01: Published primary passes repository verification

The implementation and this deployment contract are reachable from refreshed
`origin/main`; `pnpm check` exits successfully; `silvermoon check --remote
--json` reports a valid remote snapshot; and the default human-readable
`whats-next` output contains the Active ideas ID/Alias/State table. The recorded
deployment evidence confirms that no npm publication was performed.
