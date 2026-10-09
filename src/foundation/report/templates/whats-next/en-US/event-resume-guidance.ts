/**
 * @template event-resume-guidance
 * @when idea.state=abandoned|completed and idea.storage=v2
 * Guides an explicitly authorized resume without mixing it into lifecycle text.
 */
import type { EventResumeGuidanceParameters } from "../contract.ts";

/** @pure */
export const eventResumeGuidance = ({
  appendCommand,
}: EventResumeGuidanceParameters) =>
  `Resume only after an explicit human decision: use ${appendCommand} to record resume; no replay cursor or expected length is required.`;

export default eventResumeGuidance;
