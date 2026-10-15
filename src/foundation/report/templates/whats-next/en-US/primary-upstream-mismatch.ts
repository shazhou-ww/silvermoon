/**
 * @template primary-upstream-mismatch
 * @when repository.upstream.matchesPrimary=false
 * Used when the current branch does not track the configured primary branch.
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
    ? "none"
    : `\`${repository ?? remote}#${upstreamBranch ?? "unknown"}\``;
  return {
    summary:
      `Branch ${branch} has upstream ${actual}; expected ${expectedRepository}#${expectedBranch}.`,
    nextSteps:
      `The goal is for branch \`${branch}\` to track \`${expectedRepository}#${expectedBranch}\`.`,
  };
};

export default primaryUpstreamMismatch;
