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
  ideaId,
  ledgerPath,
  name,
  submissionState,
  submitAction,
  worldPath,
}: LifecycleDeployingParameters) =>
  [
    `Continue ${name} in ${documentPath}, supporting files under ${worldPath},`,
    `and ${ledgerPath}.`,
    `The current revision is ${submissionState ?? "unsubmitted"}`,
    `and control is ${controlOwner ?? "unknown"}.`,
    `When external evidence is ready, synchronize it to primary,`,
    `then use silvermoon event replay ${ideaId} --audience agent`,
    `and silvermoon event append to record ${submitAction} for the exact current revision.`,
    `Do not request ${action} before that Submit is current.`,
    `Never edit events.jsonl directly.`,
  ].join(" ");

export default lifecycleDeploying;
