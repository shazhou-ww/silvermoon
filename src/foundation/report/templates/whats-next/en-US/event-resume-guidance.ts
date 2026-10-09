/**
 * @template event-resume-guidance
 * @when idea.state=abandoned|completed and idea.storage=v2
 * Guides an explicitly authorized resume without mixing it into lifecycle text.
 */
import type { EventResumeGuidanceParameters } from "../contract.ts";

/** @pure */
export const eventResumeGuidance = ({
  appendCommand,
  replayCommand,
}: EventResumeGuidanceParameters) =>
  `Resume only after an explicit human decision: obtain the exact cursor with ${replayCommand}, then use ${appendCommand} to record resume.`;

export default eventResumeGuidance;
