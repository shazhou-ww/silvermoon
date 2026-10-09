/**
 * @template lifecycle-implementing
 * @when idea.state=implementing
 * Used when implementation work continues before acceptInner.
 */
import type { LifecycleImplementingParameters } from "../contract.ts";

/** @pure */
export default function lifecycleImplementing({
  action,
  controlOwner,
  documentPath,
  eventDigest,
  eventBacked,
  ideaId,
  idealPath,
  ledgerPath,
  name,
  primaryCommit,
  revisionReference,
  statusPath,
  submissionState,
  submitAction,
  worldPath,
}: LifecycleImplementingParameters) {
  if (eventBacked) {
    if (submissionState === "submitted") {
      return controlOwner === "upstream"
        ? `The current implementation revision was recorded by ${submitAction}; control is upstream. Present response.review and request the explicit ${action} decision for revision reference ${revisionReference}. Record an acceptance only with the full revision from response.review, using silvermoon event append ${ideaId} --expected-digest ${eventDigest ?? "<event-digest>"} --expected-primary ${primaryCommit} --audience agent; no replay cursor is required.`
        : `The current implementation revision remains recorded by ${submitAction}, but control is ${controlOwner ?? "unknown"}. Continue only the phase-local response or work that returned control downstream; use ping/pong for that exchange and do not request ${action} until control returns upstream.`;
    }
    return `Continue ${name} in ${documentPath}, supporting files under ${worldPath}, and ${ledgerPath}; do not change ${idealPath} unless the Ideal World must change. The current revision is ${submissionState ?? "unsubmitted"} and control is ${controlOwner ?? "unknown"}. When implementation evidence is ready, synchronize it to primary, then use silvermoon event append ${ideaId} --expected-digest ${eventDigest ?? "<event-digest>"} --expected-primary ${primaryCommit} --audience agent to record ${submitAction} for the exact current revision; no replay cursor or expected length is required. Do not request ${action} before that Submit is current. Never edit events.jsonl directly.`;
  }
  return `Refine the preparation seed for idea ${name} in ${documentPath}, its supporting files under ${worldPath}, and ${ledgerPath} as concrete work requires. Do not change ${idealPath} unless the Ideal World must change. After all implementation evidence is published, ask the user to accept the candidate at revision reference ${revisionReference}; only then write the full revision from response.review to implementationAcceptedRevision in ${statusPath}.`;
}
