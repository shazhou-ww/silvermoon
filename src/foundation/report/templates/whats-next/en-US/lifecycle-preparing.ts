/**
 * @template lifecycle-preparing
 * @when idea.state=preparing
 * Used when work continues in the idea contract before acceptIdeal.
 */
import type { LifecyclePreparingParameters } from "../contract.ts";

/** @pure */
export default function lifecyclePreparing({
  action,
  documentPath,
  eventBacked,
  ideaId,
  ledgerPath,
  name,
  revisionReference,
  statusPath,
}: LifecyclePreparingParameters) {
  if (eventBacked) {
    return `Continue ${name} in ${documentPath} and ${ledgerPath}. Synchronize the candidate to primary before requesting the explicit human decision for ${action} (revision reference ${revisionReference}); retain the full revision from response.review for the exact decision record. Then use silvermoon event replay ${ideaId} --audience agent and silvermoon event append with its exact stream length, file digest and refreshed primary. Never edit events.jsonl directly.`;
  }
  return `Continue idea ${name} in ${documentPath} and ${ledgerPath}. Preserve the other worlds. When the Idea contract is ready, ask the user to accept the candidate at revision reference ${revisionReference}; only after explicit acceptance write the full revision from response.review to approvedRevision in ${statusPath}.`;
}
