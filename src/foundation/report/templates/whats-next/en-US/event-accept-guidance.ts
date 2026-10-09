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
  revisionField,
  revisionKind,
  revisionReference,
  submitAction,
}: EventAcceptGuidanceParameters) =>
  `The current ${revisionKind} revision was recorded by ${submitAction}; control is upstream. Present response.review and request the explicit ${action} decision for revision reference ${revisionReference}. After that explicit decision, use ${appendCommand} to record ${action} with the full ${revisionField} from response.review; no replay cursor or expected length is required.`;

export default eventAcceptGuidance;
