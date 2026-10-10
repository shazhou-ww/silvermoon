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
    : `${repository ?? remote}#${upstreamBranch ?? "未知"}`;
  return {
    summary:
      `分支 ${branch} 的 upstream 是 ${actual}；预期为 ${expectedRepository}#${expectedBranch}。`,
    nextSteps: [
      `为 ${expectedRepository} 配置 named remote，`,
      `再将分支 ${branch} 的 upstream 设为该 remote 的 ${expectedBranch} 分支。`,
      `使用 ${verifyCommand} 验证。`,
    ].join(""),
  };
};

export default primaryUpstreamMismatch;
