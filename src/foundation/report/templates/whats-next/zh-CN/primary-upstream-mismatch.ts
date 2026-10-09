/**
 * @template primary-upstream-mismatch
 * @when repository.upstream.matchesPrimary=false
 * 用于当前分支未跟踪已配置 primary 分支时。
 */
import type {
  PrimaryUpstreamMismatchParameters,
  SummaryAndStep,
} from "../contract.ts";

/** @pure */
export default function primaryUpstreamMismatch({
  branch,
  expectedBranch,
  expectedRepository,
  remote,
  repository,
  upstreamBranch,
  verifyCommand,
}: PrimaryUpstreamMismatchParameters): SummaryAndStep {
  const actual = remote === null
    ? "无"
    : `${repository ?? remote}#${upstreamBranch ?? "未知"}`;
  return {
    summary:
      `分支 ${branch} 的 upstream 是 ${actual}；预期为 ${expectedRepository}#${expectedBranch}。`,
    step:
      `为 ${expectedRepository} 配置 named remote，再将分支 ${branch} 的 upstream 设为该 remote 的 ${expectedBranch} 分支。使用 ${verifyCommand} 验证。`,
  };
}
