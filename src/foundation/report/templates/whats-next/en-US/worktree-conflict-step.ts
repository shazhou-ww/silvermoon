/**
 * @template worktree-conflict-step
 * @when repository.changes.conflicted>0
 * Used when conflicted paths must be resolved before any remote action.
 */

/** @pure */
const worktreeConflictStep = () =>
  [
    `Inspect every conflicted path and its contents,`,
    `then resolve the conflicts without discarding either side.`,
  ].join(" ");

export default worktreeConflictStep;
