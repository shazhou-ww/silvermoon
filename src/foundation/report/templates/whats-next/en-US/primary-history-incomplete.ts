/**
 * @template primary-history-incomplete
 * @when repository.primaryRelation=unknown
 * Used when shallow history prevents a reliable primary comparison.
 */
import type {
  PrimaryRelationParameters,
  SummaryAndInstructions,
} from "../contract.ts";

/** @pure */
export default function primaryHistoryIncomplete({
  head,
  primary,
  recheckCommand,
  remote,
}: PrimaryRelationParameters): SummaryAndInstructions {
  return {
    summary:
      `Local HEAD is ${head}; observed primary is ${primary}; relationship is unknown.`,
    instructions:
      `Deepen the shallow history from remote ${remote} until ${head} and ${primary} can be compared, then run ${recheckCommand} again.`,
  };
}
