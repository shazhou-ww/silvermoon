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
  ideaId,
  idealPath,
  ledgerPath,
  name,
  submissionState,
  submitAction,
  worldPath,
}: LifecycleImplementingParameters) =>
  [
    `Continue ${name} in ${documentPath}, supporting files under ${worldPath},`,
    `and ${ledgerPath}; do not change ${idealPath} unless the Ideal World must change.`,
    `The current revision is ${submissionState ?? "unsubmitted"}`,
    `and control is ${controlOwner ?? "unknown"}.`,
    `When implementation evidence is ready, synchronize it to primary,`,
    `then use silvermoon event replay ${ideaId} --audience agent`,
    `and silvermoon event append to record ${submitAction} for the exact current revision.`,
    `Do not request ${action} before that Submit is current.`,
    `Never edit events.jsonl directly.`,
  ].join(" ");

export default lifecycleImplementing;
