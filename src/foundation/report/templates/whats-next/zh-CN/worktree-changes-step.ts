/**
 * @template worktree-changes-step
 * @when repository.changes.ordinary>0
 * 用于必须先归类已暂存、未暂存或未跟踪修改时。
 */

/** @pure */
const worktreeChangesStep = () =>
  `目标是得到 clean worktree，并让每项既有修改都有明确去向，同时保留未知工作。应检查全部 staged、unstaged 和 untracked 路径，而不只看上述样例；每项修改可根据实际情况选择提交、隔离留待后续，或仅在获得明确授权后放弃。`;

export default worktreeChangesStep;
