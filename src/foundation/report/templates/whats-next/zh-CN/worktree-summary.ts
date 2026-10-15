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
  const labels: Record<string, string> = {
    conflicted: "冲突",
    staged: "已暂存",
    unstaged: "未暂存",
    untracked: "未跟踪",
  };
  const countText = [
    ["冲突", counts.conflicted],
    ["已暂存", counts.staged],
    ["未暂存", counts.unstaged],
    ["未跟踪", counts.untracked],
  ].flatMap(([kind, count]) =>
    typeof count === "number" && count > 0 ? [`${count} 个${kind}修改`] : []
  ).join("、");
  const sampleText = samples.map((sample) => {
    const separator = sample.indexOf(":");
    const kind = separator < 0 ? "changed" : sample.slice(0, separator);
    const path = separator < 0 ? sample : sample.slice(separator + 1);
    return `${labels[kind] ?? "已修改"}的 \`${path}\``;
  }).join("、");
  return [
    `工作区包含${countText}。`,
    ...(sampleText === "" ? [] : [`已观测路径包括${sampleText}。`]),
    ...(omitted === 0 ? [] : [`另有 ${omitted} 个路径未显示。`]),
  ].join("");
};

export default worktreeSummary;
