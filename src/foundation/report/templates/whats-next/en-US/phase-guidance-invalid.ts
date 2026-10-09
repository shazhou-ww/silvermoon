/**
 * @template phase-guidance-invalid
 * @when guidance.state=invalid
 * Used when current-phase guidance must be repaired before continuing.
 */
import type { RecheckParameters } from "../contract.ts";

/** @pure */
export default function phaseGuidanceInvalid({
  recheckCommand,
}: RecheckParameters) {
  return `After repairing the current phase guidance, run ${recheckCommand} again.`;
}
