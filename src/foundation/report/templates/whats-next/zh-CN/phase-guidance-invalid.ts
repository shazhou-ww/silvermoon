/**
 * @template phase-guidance-invalid
 * @when guidance.state=invalid
 * 用于当前阶段 guidance 必须先修复才能继续时。
 */
import type { RecheckParameters } from "../contract.ts";

/** @pure */
export default function phaseGuidanceInvalid({
  recheckCommand,
}: RecheckParameters) {
  return `修复当前阶段 guidance 后，再运行 ${recheckCommand}。`;
}
