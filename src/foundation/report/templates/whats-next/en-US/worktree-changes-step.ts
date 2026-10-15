/**
 * @template worktree-changes-step
 * @when repository.changes.ordinary>0
 * Used when staged, unstaged, or untracked changes must be classified.
 */

/** @pure */
const worktreeChangesStep = () =>
  [
    `The goal is a clean worktree in which every existing change has an`,
    `intentional disposition and unknown work is preserved.`,
    `Inspect all staged, unstaged, and untracked paths, not only the samples above;`,
    `possible outcomes for each change include committing it, isolating it for later,`,
    `or discarding it only with explicit authorization.`,
  ].join(" ");

export default worktreeChangesStep;
