/**
 * @template lifecycle-preparing
 * @when idea.state=preparing
 * Used when work continues in the idea contract before acceptIdeal.
 */
import type { LifecyclePreparingParameters } from "../contract.ts";

/** @pure */
const lifecyclePreparing = ({
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
}: LifecyclePreparingParameters) =>
  [
    `Continue the current idea ${name} in phase file ${documentPath}`,
    `and ledger ${ledgerPath}.`,
    `The current revision is ${submissionState ?? "unsubmitted"}`,
    `and control is ${controlOwner ?? "unknown"}.`,
    `When the Idea candidate is ready, synchronize it to primary,`,
    `then use silvermoon event append ${ideaId}`,
    `--expected-digest ${eventDigest ?? "<event-digest>"}`,
    `--expected-primary ${primaryCommit} --audience agent`,
    `to record ${submitAction} for the exact current revision;`,
    `no replay cursor or expected length is required.`,
    `Do not request ${action} before that Submit is current.`,
    `Never edit events.jsonl directly.`,
  ].join(" ");

export default lifecyclePreparing;
