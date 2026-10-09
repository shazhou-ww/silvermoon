/**
 * @template event-interaction-guidance
 * @when idea.submission=current-phase-submitted and idea.control!=upstream
 * Guides phase-local ping/pong exchange without changing the submission.
 */
import type { EventInteractionGuidanceParameters } from "../contract.ts";

/** @pure */
export const eventInteractionGuidance = ({
  action,
  appendCommand,
  controlOwner,
  replayCommand,
  revisionKind,
  submitAction,
}: EventInteractionGuidanceParameters) =>
  `The current ${revisionKind} revision remains recorded by ${submitAction}, but control is ${controlOwner ?? "unknown"}. Continue only the phase-local response or work that returned control downstream; obtain the exact cursor with ${replayCommand}, then use ${appendCommand} for that ping/pong exchange and do not request ${action} until control returns upstream.`;

export default eventInteractionGuidance;
