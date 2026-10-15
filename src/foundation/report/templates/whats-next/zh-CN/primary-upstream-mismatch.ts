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
  verifyCommand,
}: PrimaryUpstreamMismatchParameters): SummaryAndNextSteps => {
  const actual = remote === null
    ? "无"
    : `\`${repository ?? remote}#${upstreamBranch ?? "未知"}\``;
  return {
    summary:
      `分支 ${branch} 的 upstream 是 ${actual}；预期为 ${expectedRepository}#${expectedBranch}。`,
    nextSteps: [
      `目标是让分支 \`${branch}\` 跟踪 \`${expectedRepository}#${expectedBranch}\`。`,
      `可选步骤包括复用或新增指向该 repository 的 named remote，`,
      `再把分支 upstream 设为该 remote 的 \`${expectedBranch}\` 分支。`,
      `继续工作前可用 ${verifyCommand} 确认最终 upstream。`,
    ].join(""),
  };
};

export default primaryUpstreamMismatch;
