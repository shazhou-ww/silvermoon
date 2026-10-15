/**
 * @template worktree-changes-step
 * @when repository.changes.ordinary>0
 * 用于必须先归类已暂存、未暂存或未跟踪修改时。
 */

/** @pure */
const worktreeChangesStep = () =>
  `目标是得到 clean worktree，并让每项既有修改都有明确去向，同时保留未知工作。`;

export default worktreeChangesStep;
