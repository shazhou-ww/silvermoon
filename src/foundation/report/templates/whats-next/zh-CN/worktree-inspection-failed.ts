/**
 * @template worktree-inspection-failed
 * @when repository.inspectLocal=failed
 * 用于无法安全检查本地 Git 状态时。
 */
import type { RecheckParameters } from "../contract.ts";

/** @pure */
const worktreeInspectionFailed = (
  _parameters: RecheckParameters,
) =>
  `目标是让本地 Git 状态可以安全检查全部 worktree 修改。`;

export default worktreeInspectionFailed;
