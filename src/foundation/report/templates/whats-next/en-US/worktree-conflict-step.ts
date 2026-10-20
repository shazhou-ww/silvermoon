/**
 * @template worktree-conflict-step
 * @when repository.changes.conflicted>0
 * Used when conflicted paths must be resolved before any remote action.
 */

/** @pure */
const worktreeConflictStep = () =>
  `The goal is a worktree with no conflicted paths while preserving both sides' content.`;

export default worktreeConflictStep;
