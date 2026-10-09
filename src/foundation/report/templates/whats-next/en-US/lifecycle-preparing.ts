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
  ideaId,
  ledgerPath,
  name,
  submissionState,
  submitAction,
}: LifecyclePreparingParameters) =>
  [
    `Continue the current idea ${name} in phase file ${documentPath}`,
    `and ledger ${ledgerPath}.`,
    `The current revision is ${submissionState ?? "unsubmitted"}`,
    `and control is ${controlOwner ?? "unknown"}.`,
    `When the Idea candidate is ready, synchronize it to primary,`,
    `then use silvermoon event replay ${ideaId} --audience agent`,
    `and silvermoon event append to record ${submitAction} for the exact current revision.`,
    `Do not request ${action} before that Submit is current.`,
    `Never edit events.jsonl directly.`,
  ].join(" ");

export default lifecyclePreparing;
