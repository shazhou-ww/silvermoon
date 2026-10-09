/**
 * @template worktree-conflict-step
 * @when repository.changes.conflicted>0
 * 用于任何远程操作前必须先解决冲突路径时。
 */

/** @pure */
export default function worktreeConflictStep() {
  return "检查全部冲突路径及其内容，再在不丢弃任一方内容的前提下解决冲突。";
}
