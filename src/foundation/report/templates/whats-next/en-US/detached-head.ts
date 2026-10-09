/**
 * @template detached-head
 * @when repository.branch=null
 * Used when repository work is not attached to a local branch.
 */
import type {
  DetachedHeadParameters,
  SummaryAndStep,
} from "../contract.ts";

/** @pure */
const detachedHead = ({
  expectedBranch,
  expectedRepository,
  head,
}: DetachedHeadParameters): SummaryAndStep =>
  ({
    summary: head === null
      ? "The repository has no current local branch."
      : `HEAD ${head} is detached and has no current branch.`,
    step: [
      `Preserve current work, then switch to or create the intended local branch`,
      `whose upstream is ${expectedRepository}#${expectedBranch}.`,
    ].join(" "),
  });

export default detachedHead;
