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
  ledgerPath,
  name,
  revisionReference,
  statusPath,
  submissionState,
}: LifecyclePreparingParameters) {
  if (eventBacked) {
    return submissionState === "submitted"
      ? ""
      : `Continue ${name} in ${documentPath} and ${ledgerPath}.`;
  }
  return `Continue idea ${name} in ${documentPath} and ${ledgerPath}. Preserve the other worlds. When the Idea contract is ready, ask the user to accept the candidate at revision reference ${revisionReference}; only after explicit acceptance write the full revision from response.review to approvedRevision in ${statusPath}.`;
}
