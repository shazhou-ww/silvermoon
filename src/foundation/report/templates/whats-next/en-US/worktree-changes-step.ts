/**
 * @template worktree-changes-step
 * @when repository.changes.ordinary>0
 * Used when staged, unstaged, or untracked changes must be classified.
 */

/** @pure */
const worktreeChangesStep = () =>
  `The goal is a clean worktree in which every existing change has an intentional disposition and unknown work is preserved.`;

export default worktreeChangesStep;
