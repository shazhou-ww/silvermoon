/**
 * @template worktree-summary
 * @when repository.changes.observed=true
 * 用于汇总有界的 worktree 修改数量和路径样例。
 */
import type { WorktreeSummaryParameters } from "../contract.ts";

/** @pure */
const worktreeSummary = ({
  counts,
  omitted,
  samples,
}: WorktreeSummaryParameters) => {
  const countText = [
    ["冲突", counts.conflicted],
    ["已暂存", counts.staged],
    ["未暂存", counts.unstaged],
    ["未跟踪", counts.untracked],
  ].map(([kind, count]) => `${kind}=${count}`).join("，");
  const sampleText = samples.length === 0 ? "无" : samples.join("，");
  return `${countText}；样例=[${sampleText}]；省略=${omitted}`;
};

export default worktreeSummary;
