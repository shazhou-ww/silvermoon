/**
 * @template worktree-inspection-failed
 * @when repository.inspectLocal=failed
 * 用于无法安全检查本地 Git 状态时。
 */
import type { RecheckParameters } from "../contract.ts";

/** @pure */
export default function worktreeInspectionFailed({
  recheckCommand,
}: RecheckParameters) {
  return `修复本地 Git 状态，确认可检查全部修改后，再运行 ${recheckCommand}。`;
}
