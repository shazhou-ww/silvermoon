/**
 * @template phase-guidance-invalid
 * @when guidance.state=invalid
 * Used when current-phase guidance must be repaired before continuing.
 */
import type { RecheckParameters } from "../contract.ts";

/** @pure */
const phaseGuidanceInvalid = ({
  recheckCommand,
}: RecheckParameters) =>
  `After repairing the current phase guidance, run ${recheckCommand} again.`;

export default phaseGuidanceInvalid;
