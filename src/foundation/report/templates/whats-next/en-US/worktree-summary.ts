/**
 * @template worktree-summary
 * @when repository.changes.observed=true
 * Used to summarize bounded worktree change counts and path samples.
 */
import type { WorktreeSummaryParameters } from "../contract.ts";

/** @pure */
const worktreeSummary = ({
  counts,
  omitted,
  samples,
}: WorktreeSummaryParameters) => {
  const countText = [
    ["conflicted", counts.conflicted],
    ["staged", counts.staged],
    ["unstaged", counts.unstaged],
    ["untracked", counts.untracked],
  ].map(([kind, count]) => `${kind}=${count}`).join(", ");
  const sampleText = samples.length === 0 ? "none" : samples.join(", ");
  return `${countText}; samples=[${sampleText}]; omitted=${omitted}`;
};

export default worktreeSummary;
