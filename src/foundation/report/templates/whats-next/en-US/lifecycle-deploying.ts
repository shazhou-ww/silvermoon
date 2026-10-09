/**
 * @template lifecycle-deploying
 * @when idea.state=deploying
 * Used when deployment work continues before acceptOuter.
 */
import type { LifecycleDeployingParameters } from "../contract.ts";

/** @pure */
const lifecycleDeploying = ({
  action,
  controlOwner,
  documentPath,
  eventDigest,
  ideaId,
  ledgerPath,
  name,
  primaryCommit,
  submissionState,
  submitAction,
  worldPath,
}: LifecycleDeployingParameters) =>
  [
    `Continue the current idea ${name} in phase file ${documentPath},`,
    `related supporting files under ${worldPath}, and ledger ${ledgerPath}.`,
    `The current revision is ${submissionState ?? "unsubmitted"}`,
    `and control is ${controlOwner ?? "unknown"}.`,
    `When external evidence is ready, synchronize it to primary,`,
    `then use silvermoon event append ${ideaId}`,
    `--expected-digest ${eventDigest ?? "<event-digest>"}`,
    `--expected-primary ${primaryCommit} --audience agent`,
    `to record ${submitAction} for the exact current revision;`,
    `no replay cursor or expected length is required.`,
    `Do not request ${action} before that Submit is current.`,
    `Never edit events.jsonl directly.`,
  ].join(" ");

export default lifecycleDeploying;
