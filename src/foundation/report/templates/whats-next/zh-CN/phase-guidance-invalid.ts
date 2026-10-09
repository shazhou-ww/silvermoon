/**
 * @template phase-guidance-invalid
 * @when guidance.state=invalid
 * 用于当前阶段 guidance 必须先修复才能继续时。
 */
import type { RecheckParameters } from "../contract.ts";

/** @pure */
const phaseGuidanceInvalid = ({
  recheckCommand,
}: RecheckParameters) =>
  `修复当前阶段 guidance 后，再运行 ${recheckCommand}。`;

export default phaseGuidanceInvalid;
