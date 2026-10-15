/**
 * @template primary-ahead
 * @when repository.primaryRelation=ahead
 * Used when validated local history must be pushed normally to primary.
 */
import type {
  PrimaryRelationParameters,
  SummaryAndNextSteps,
} from "../contract.ts";

/** @pure */
const primaryAhead = ({
  head,
  primary,
  primaryBranch,
  remote,
}: PrimaryRelationParameters): SummaryAndNextSteps =>
  ({
    summary:
      `Local HEAD is ${head}; observed primary is ${primary}; relationship is ahead.`,
    nextSteps:
      `The goal is for validated local HEAD ${head} to be reachable from ${remote}/${primaryBranch} through ordinary non-force synchronization while preserving concurrent primary history.`,
  });

export default primaryAhead;
