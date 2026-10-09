/**
 * @template worktree-conflicts
 * @when repository.changes.conflicted>0
 * 用作 worktree 冲突路径的问题概要。
 */
import type { WorktreeConflictsParameters } from "../contract.ts";

/** @pure */
export default function worktreeConflicts({
  count,
  summary,
}: WorktreeConflictsParameters) {
  return `${count} 个冲突路径；${summary}`;
}
