/**
 * @template event-accept-guidance
 * @when idea.submission=current-phase-submitted and idea.control=upstream
 * Guides the upstream owner through the explicit acceptance event.
 */
import type { EventAcceptGuidanceParameters } from "../contract.ts";

/** @pure */
export const eventAcceptGuidance = ({
  action,
  appendCommand,
  replayCommand,
  revisionField,
  revisionKind,
  revisionReference,
  submitAction,
}: EventAcceptGuidanceParameters) =>
  `The current ${revisionKind} revision was recorded by ${submitAction}; control is upstream. Present response.review and request the explicit ${action} decision for revision reference ${revisionReference}. After that explicit decision, obtain the exact cursor with ${replayCommand}, then use ${appendCommand} to record ${action} with the full ${revisionField} from response.review.`;

export default eventAcceptGuidance;
