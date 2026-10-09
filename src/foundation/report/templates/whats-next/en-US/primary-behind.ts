/**
 * @template primary-behind
 * @when repository.primaryRelation=behind
 * Used when local HEAD can fast-forward to the observed primary.
 */
import type {
  PrimaryRelationParameters,
  SummaryAndInstructions,
} from "../contract.ts";

/** @pure */
export default function primaryBehind({
  branch,
  head,
  mergeCommand,
  primary,
  recheckCommand,
}: PrimaryRelationParameters): SummaryAndInstructions {
  return {
    summary:
      `Local HEAD is ${head}; observed primary is ${primary}; relationship is behind.`,
    instructions:
      `Fast-forward branch ${branch} to observed primary ${primary} with ${mergeCommand} without rewriting history, then run ${recheckCommand} again.`,
  };
}
