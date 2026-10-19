/**
 * @template primary-history-incomplete
 * @when repository.primaryRelation=unknown
 * Used when shallow history prevents a reliable primary comparison.
 */
import type {
  PrimaryRelationParameters,
  SummaryAndNextSteps,
} from "../contract.ts";

/** @pure */
const primaryHistoryIncomplete = ({
  head,
  primary,
}: PrimaryRelationParameters): SummaryAndNextSteps =>
  ({
    summary:
      `Local HEAD is ${head}; observed primary is ${primary}; relationship is unknown.`,
    nextSteps:
      `The goal is sufficient local history to compare ${head} with observed primary ${primary} reliably.`,
  });

export default primaryHistoryIncomplete;
