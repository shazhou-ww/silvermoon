/**
 * @template worktree-changes-step
 * @when repository.changes.ordinary>0
 * Used when staged, unstaged, or untracked changes must be classified.
 */

/** @pure */
const worktreeChangesStep = () =>
  [
    `Inspect all staged, unstaged, and untracked paths and their changes,`,
    `not just the samples above.`,
    `Preserve unknown work, then commit, isolate, or explicitly discard each change.`,
  ].join(" ");

export default worktreeChangesStep;
