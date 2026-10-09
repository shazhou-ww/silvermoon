/**
 * @template event-submit-guidance
 * @when idea.submission=current-phase-unsubmitted|stale
 * Guides the downstream owner to record the current phase submission.
 */
import type { EventSubmitGuidanceParameters } from "../contract.ts";

/** @pure */
export const eventSubmitGuidance = ({
  acceptanceAction,
  action,
  appendCommand,
  controlOwner,
  evidence,
  revisionKind,
  submissionState,
}: EventSubmitGuidanceParameters) =>
  `The current ${revisionKind} revision is ${submissionState ?? "unsubmitted"} and control is ${controlOwner ?? "unknown"}. When ${evidence} is ready, synchronize it to primary, then use ${appendCommand} to record ${action} for the exact current revision; no replay cursor or expected length is required. Do not request ${acceptanceAction} before that Submit is current. Never edit events.jsonl directly.`;

export default eventSubmitGuidance;
