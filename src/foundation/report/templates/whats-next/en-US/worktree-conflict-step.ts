/**
 * @template worktree-conflict-step
 * @when repository.changes.conflicted>0
 * Used when conflicted paths must be resolved before any remote action.
 */

/** @pure */
export default function worktreeConflictStep() {
  return "Inspect every conflicted path and its contents, then resolve the conflicts without discarding either side.";
}
