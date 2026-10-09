/**
 * @template lifecycle-deploying
 * @when idea.state=deploying
 * Used when deployment work continues before acceptOuter.
 */
import type { LifecycleDeployingParameters } from "../contract.ts";

/** @pure */
export default function lifecycleDeploying({
  action,
  controlOwner,
  documentPath,
  eventBacked,
  ideaId,
  ledgerPath,
  name,
  revisionReference,
  statusPath,
  submissionState,
  submitAction,
  worldPath,
}: LifecycleDeployingParameters) {
  if (eventBacked) {
    if (submissionState === "submitted") {
      return controlOwner === "upstream"
        ? `The current deployment revision was recorded by ${submitAction}; control is upstream. Present response.review and request the explicit ${action} decision for revision reference ${revisionReference}. Record an acceptance only with the full revision from response.review and an exact silvermoon event replay ${ideaId} --audience agent cursor.`
        : `The current deployment revision remains recorded by ${submitAction}, but control is ${controlOwner ?? "unknown"}. Continue only the phase-local response or work that returned control downstream; use ping/pong for that exchange and do not request ${action} until control returns upstream.`;
    }
    return `Continue ${name} in ${documentPath}, supporting files under ${worldPath}, and ${ledgerPath}. The current revision is ${submissionState ?? "unsubmitted"} and control is ${controlOwner ?? "unknown"}. When external evidence is ready, synchronize it to primary, then use silvermoon event replay ${ideaId} --audience agent and silvermoon event append to record ${submitAction} for the exact current revision. Do not request ${action} before that Submit is current. Never edit events.jsonl directly.`;
  }
  return `Refine the preparation seed for idea ${name} from ${documentPath}, its supporting files under ${worldPath}, and ${ledgerPath}. Preserve nested worlds. After external evidence is complete and published, ask the user to accept the candidate at revision reference ${revisionReference}; only then write the full revision from response.review to deploymentAcceptedRevision in ${statusPath}.`;
}
