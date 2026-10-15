/**
 * @template worktree-inspection-failed
 * @when repository.inspectLocal=failed
 * Used when local Git state cannot be inspected safely.
 */
import type { RecheckParameters } from "../contract.ts";

/** @pure */
const worktreeInspectionFailed = (
  _parameters: RecheckParameters,
) =>
  `The goal is a local Git state in which every worktree change can be inspected safely.`;

export default worktreeInspectionFailed;
