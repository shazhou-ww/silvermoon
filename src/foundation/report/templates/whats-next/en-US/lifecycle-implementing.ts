/**
 * @template lifecycle-implementing
 * @when idea.state=implementing
 * Used when implementation work continues before acceptInner.
 */
import type { LifecycleImplementingParameters } from "../contract.ts";

/** @pure */
const lifecycleImplementing = ({
  action,
  controlOwner,
  documentPath,
  eventDigest,
  ideaId,
  idealPath,
  ledgerPath,
  name,
  primaryCommit,
  submissionState,
  submitAction,
  worldPath,
}: LifecycleImplementingParameters) =>
  [
    `Continue the current idea ${name} in phase file ${documentPath},`,
    `related supporting files under ${worldPath}, and ledger ${ledgerPath}.`,
    `Do not change the canonical idea file ${idealPath}`,
    `unless the current idea requirements must change.`,
    `The current revision is ${submissionState ?? "unsubmitted"}`,
    `and control is ${controlOwner ?? "unknown"}.`,
    `When implementation evidence is ready, synchronize it to primary,`,
    `then use silvermoon event append ${ideaId}`,
    `--expected-digest ${eventDigest ?? "<event-digest>"}`,
    `--expected-primary ${primaryCommit} --audience agent`,
    `to record ${submitAction} for the exact current revision;`,
    `no replay cursor or expected length is required.`,
    `Do not request ${action} before that Submit is current.`,
    `Never edit events.jsonl directly.`,
  ].join(" ");

export default lifecycleImplementing;
