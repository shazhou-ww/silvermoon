/**
 * @template primary-upstream-mismatch
 * @when repository.upstream.matchesPrimary=false
 * 用于当前分支未跟踪已配置 primary 分支时。
 */
import type {
  PrimaryUpstreamMismatchParameters,
  SummaryAndNextSteps,
} from "../contract.ts";

/** @pure */
const primaryUpstreamMismatch = ({
  branch,
  expectedBranch,
  expectedRepository,
  remote,
  repository,
  upstreamBranch,
}: PrimaryUpstreamMismatchParameters): SummaryAndNextSteps => {
  const actual = remote === null
    ? "无"
    : `\`${repository ?? remote}#${upstreamBranch ?? "未知"}\``;
  return {
    summary:
      `分支 ${branch} 的 upstream 是 ${actual}；预期为 ${expectedRepository}#${expectedBranch}。`,
    nextSteps:
      `目标是让分支 \`${branch}\` 跟踪 \`${expectedRepository}#${expectedBranch}\`。`,
  };
};

export default primaryUpstreamMismatch;
