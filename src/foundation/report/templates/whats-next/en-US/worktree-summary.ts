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
    ["conflicted change", counts.conflicted],
    ["staged change", counts.staged],
    ["unstaged change", counts.unstaged],
    ["untracked change", counts.untracked],
  ].flatMap(([kind, count]) =>
    typeof count === "number" && count > 0
      ? [`${count} ${kind}${count === 1 ? "" : "s"}`]
      : []
  ).join(", ");
  const sampleText = samples.map((sample) => {
    const separator = sample.indexOf(":");
    const kind = separator < 0 ? "changed" : sample.slice(0, separator);
    const path = separator < 0 ? sample : sample.slice(separator + 1);
    return `${kind} \`${path}\``;
  }).join(", ");
  return [
    `The worktree contains ${countText}.`,
    ...(sampleText === "" ? [] : [`Observed paths include ${sampleText}.`]),
    ...(omitted === 0
      ? []
      : [`${omitted} additional path${omitted === 1 ? " is" : "s are"} not shown.`]),
  ].join(" ");
};

export default worktreeSummary;
