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
  recheckCommand,
  remote,
}: PrimaryRelationParameters): SummaryAndNextSteps =>
  ({
    summary:
      `Local HEAD is ${head}; observed primary is ${primary}; relationship is unknown.`,
    nextSteps: [
      `Deepen the shallow history from remote ${remote}`,
      `until ${head} and ${primary} can be compared,`,
      `then run ${recheckCommand} again.`,
    ].join(" "),
  });

export default primaryHistoryIncomplete;
