/**
 * @template worktree-conflicts
 * @when repository.changes.conflicted>0
 * Used as the problem summary for conflicted worktree paths.
 */
import type { WorktreeConflictsParameters } from "../contract.ts";

/** @pure */
export default function worktreeConflicts({
  count,
  summary,
}: WorktreeConflictsParameters) {
  return `${count} conflicted path(s); ${summary}`;
}
