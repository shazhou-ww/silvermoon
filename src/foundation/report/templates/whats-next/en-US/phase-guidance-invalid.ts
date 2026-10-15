/**
 * @template phase-guidance-invalid
 * @when guidance.state=invalid
 * Used when current-phase guidance must be repaired before continuing.
 */
import type { RecheckParameters } from "../contract.ts";

/** @pure */
const phaseGuidanceInvalid = (
  _parameters: RecheckParameters,
) =>
  "The goal is valid current-phase guidance that preserves the repository's policy intent.";

export default phaseGuidanceInvalid;
