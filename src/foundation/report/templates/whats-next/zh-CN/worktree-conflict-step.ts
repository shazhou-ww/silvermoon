/**
 * @template worktree-conflict-step
 * @when repository.changes.conflicted>0
 * 用于任何远程操作前必须先解决冲突路径时。
 */

/** @pure */
const worktreeConflictStep = () =>
  `目标是在保留双方内容的前提下，让 worktree 不再包含冲突路径。`;

export default worktreeConflictStep;
