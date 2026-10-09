/**
 * @template lifecycle-implementing
 * @when idea.state=implementing
 * Used when implementation work continues before acceptInner.
 */
import type { LifecycleImplementingParameters } from "../contract.ts";

/** @pure */
export default function lifecycleImplementing({
  action,
  documentPath,
  eventBacked,
  ideaId,
  idealPath,
  ledgerPath,
  name,
  revisionReference,
  statusPath,
  worldPath,
}: LifecycleImplementingParameters) {
  if (eventBacked) {
    return `Continue ${name} in ${documentPath} and ${ledgerPath}. Synchronize the candidate to primary before requesting the explicit human decision for ${action} (revision reference ${revisionReference}); retain the full revision from response.review for the exact decision record. Then use silvermoon event replay ${ideaId} --audience agent and silvermoon event append with its exact stream length, file digest and refreshed primary. Never edit events.jsonl directly.`;
  }
  return `Refine the preparation seed for idea ${name} in ${documentPath}, its supporting files under ${worldPath}, and ${ledgerPath} as concrete work requires. Do not change ${idealPath} unless the Ideal World must change. After all implementation evidence is published, ask the user to accept the candidate at revision reference ${revisionReference}; only then write the full revision from response.review to implementationAcceptedRevision in ${statusPath}.`;
}
