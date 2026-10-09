/**
 * @template lifecycle-deploying
 * @when idea.state=deploying
 * Used when deployment work continues before acceptOuter.
 */
import type { LifecycleDeployingParameters } from "../contract.ts";

/** @pure */
export default function lifecycleDeploying({
  action,
  documentPath,
  eventBacked,
  ledgerPath,
  name,
  revisionReference,
  statusPath,
  submissionState,
  worldPath,
}: LifecycleDeployingParameters) {
  if (eventBacked) {
    return submissionState === "submitted"
      ? ""
      : `Continue ${name} in ${documentPath}, supporting files under ${worldPath}, and ${ledgerPath}.`;
  }
  return `Refine the preparation seed for idea ${name} from ${documentPath}, its supporting files under ${worldPath}, and ${ledgerPath}. Preserve nested worlds. After external evidence is complete and published, ask the user to accept the candidate at revision reference ${revisionReference}; only then write the full revision from response.review to deploymentAcceptedRevision in ${statusPath}.`;
}
