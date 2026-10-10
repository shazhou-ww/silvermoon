/**
 * @template lifecycle-preparing
 * @when idea.state=preparing
 * Used when work continues in the idea contract before acceptIdeal.
 */
import type { LifecyclePreparingParameters } from "../contract.ts";

/** @pure */
export default function lifecyclePreparing({
  action,
  controlOwner,
  documentPath,
  eventDigest,
  eventBacked,
  ideaId,
  ledgerPath,
  name,
  primaryCommit,
  revisionReference,
  statusPath,
  submissionState,
  submitAction,
}: LifecyclePreparingParameters) {
  if (eventBacked) {
    if (submissionState === "submitted") {
      return controlOwner === "upstream"
        ? `The current Idea revision was recorded by ${submitAction}; control is upstream. Present response.review and request the explicit ${action} decision for revision reference ${revisionReference}. Record an acceptance only with the full revision from response.review, using silvermoon event append ${ideaId} --expected-digest ${eventDigest ?? "<event-digest>"} --expected-primary ${primaryCommit} --audience agent; no replay cursor is required.`
        : `The current Idea revision remains recorded by ${submitAction}, but control is ${controlOwner ?? "unknown"}. Continue only the phase-local response or work that returned control downstream; use ping/pong for that exchange and do not request ${action} until control returns upstream.`;
    }
    return `Continue ${name} in ${documentPath} and ${ledgerPath}. The current revision is ${submissionState ?? "unsubmitted"} and control is ${controlOwner ?? "unknown"}. When the Idea candidate is ready, synchronize it to primary, then use silvermoon event append ${ideaId} --expected-digest ${eventDigest ?? "<event-digest>"} --expected-primary ${primaryCommit} --audience agent to record ${submitAction} for the exact current revision; no replay cursor or expected length is required. Do not request ${action} before that Submit is current. Never edit events.jsonl directly.`;
  }
  return `Continue idea ${name} in ${documentPath} and ${ledgerPath}. Preserve the other worlds. When the Idea contract is ready, ask the user to accept the candidate at revision reference ${revisionReference}; only after explicit acceptance write the full revision from response.review to approvedRevision in ${statusPath}.`;
}
