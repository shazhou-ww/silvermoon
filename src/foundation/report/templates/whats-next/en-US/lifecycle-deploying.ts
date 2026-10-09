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
  ideaId,
  ledgerPath,
  name,
  revisionReference,
  statusPath,
  worldPath,
}: LifecycleDeployingParameters) {
  if (eventBacked) {
    return `Continue ${name} in ${documentPath} and ${ledgerPath}. Synchronize the candidate to primary before requesting the explicit human decision for ${action} (revision reference ${revisionReference}); retain the full revision from response.review for the exact decision record. Then use silvermoon event replay ${ideaId} --audience agent and silvermoon event append with its exact stream length, file digest and refreshed primary. Never edit events.jsonl directly.`;
  }
  return `Refine the preparation seed for idea ${name} from ${documentPath}, its supporting files under ${worldPath}, and ${ledgerPath}. Preserve nested worlds. After external evidence is complete and published, ask the user to accept the candidate at revision reference ${revisionReference}; only then write the full revision from response.review to deploymentAcceptedRevision in ${statusPath}.`;
}
