/**
 * @template worktree-conflicts
 * @when repository.changes.conflicted>0
 * Used as the problem summary for conflicted worktree paths.
 */
import type { WorktreeConflictsParameters } from "../contract.ts";

/** @pure */
const worktreeConflicts = ({
  count,
  summary,
}: WorktreeConflictsParameters) =>
  `${count} conflicted path(s); ${summary}`;

export default worktreeConflicts;
