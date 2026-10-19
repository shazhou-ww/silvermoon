/**
 * @template detached-head
 * @when repository.branch=null
 * Used when repository work is not attached to a local branch.
 */
import type {
  DetachedHeadParameters,
  SummaryAndNextSteps,
} from "../contract.ts";

/** @pure */
const detachedHead = ({
  expectedBranch,
  expectedRepository,
  head,
}: DetachedHeadParameters): SummaryAndNextSteps =>
  ({
    summary: head === null
      ? "The repository has no current local branch."
      : `HEAD ${head} is detached and has no current branch.`,
    nextSteps: [
      `The goal is to attach the current work to a local branch whose upstream is`,
      `\`${expectedRepository}#${expectedBranch}\` without losing any work.`,
    ].join(" "),
  });

export default detachedHead;
