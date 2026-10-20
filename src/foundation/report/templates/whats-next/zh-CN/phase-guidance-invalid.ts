/**
 * @template phase-guidance-invalid
 * @when guidance.state=invalid
 * 用于当前阶段 guidance 必须先修复才能继续时。
 */
import type { RecheckParameters } from "../contract.ts";

/** @pure */
const phaseGuidanceInvalid = (
  _parameters: RecheckParameters,
) =>
  "目标是在保留 repository policy 意图的前提下得到有效的当前阶段 guidance。";

export default phaseGuidanceInvalid;
