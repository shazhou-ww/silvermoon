/**
 * @template worktree-changes-step
 * @when repository.changes.ordinary>0
 * 用于必须先归类已暂存、未暂存或未跟踪修改时。
 */

/** @pure */
const worktreeChangesStep = () =>
  `检查全部 staged、unstaged 和 untracked 路径及其修改内容，不要只依据上述样例。保留未知工作，再逐项提交、隔离，或在获得明确授权后放弃。`;

export default worktreeChangesStep;
