/**
 * @template primary-upstream-mismatch
 * @when repository.upstream.matchesPrimary=false
 * Used when the current branch does not track the configured primary branch.
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
    ? "none"
    : `${repository ?? remote}#${upstreamBranch ?? "unknown"}`;
  return {
    summary:
      `Branch ${branch} has upstream ${actual}; expected ${expectedRepository}#${expectedBranch}.`,
    step:
      `Configure a named remote for ${expectedRepository}, then set branch ${branch} to track that remote's ${expectedBranch} branch. Verify with ${verifyCommand}.`,
  };
}
