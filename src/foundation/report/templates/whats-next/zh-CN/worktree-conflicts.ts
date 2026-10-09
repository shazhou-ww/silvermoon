/**
 * @template worktree-conflicts
 * @when repository.changes.conflicted>0
 * 用作 worktree 冲突路径的问题概要。
 */
import type { WorktreeConflictsParameters } from "../contract.ts";

/** @pure */
const worktreeConflicts = ({
  count,
  summary,
}: WorktreeConflictsParameters) =>
  `${count} 个冲突路径；${summary}`;

export default worktreeConflicts;
