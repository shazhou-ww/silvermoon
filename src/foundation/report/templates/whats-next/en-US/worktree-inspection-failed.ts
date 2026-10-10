/**
 * @template worktree-inspection-failed
 * @when repository.inspectLocal=failed
 * Used when local Git state cannot be inspected safely.
 */
import type { RecheckParameters } from "../contract.ts";

/** @pure */
const worktreeInspectionFailed = ({
  recheckCommand,
}: RecheckParameters) =>
  [
    `Repair the local Git state, verify that all changes can be inspected,`,
    `then run ${recheckCommand} again.`,
  ].join(" ");

export default worktreeInspectionFailed;
