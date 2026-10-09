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
  idealPath,
  ledgerPath,
  name,
  revisionReference,
  statusPath,
  submissionState,
  worldPath,
}: LifecycleImplementingParameters) {
  if (eventBacked) {
    return submissionState === "submitted"
      ? ""
      : `Continue ${name} in ${documentPath}, supporting files under ${worldPath}, and ${ledgerPath}; do not change ${idealPath} unless the Ideal World must change.`;
  }
  return `Refine the preparation seed for idea ${name} in ${documentPath}, its supporting files under ${worldPath}, and ${ledgerPath} as concrete work requires. Do not change ${idealPath} unless the Ideal World must change. After all implementation evidence is published, ask the user to accept the candidate at revision reference ${revisionReference}; only then write the full revision from response.review to implementationAcceptedRevision in ${statusPath}.`;
}
