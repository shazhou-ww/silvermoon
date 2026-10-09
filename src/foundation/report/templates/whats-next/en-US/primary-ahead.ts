/**
 * @template primary-ahead
 * @when repository.primaryRelation=ahead
 * Used when validated local history must be pushed normally to primary.
 */
import type {
  PrimaryRelationParameters,
  SummaryAndInstructions,
} from "../contract.ts";

/** @pure */
export default function primaryAhead({
  head,
  primary,
  primaryBranch,
  recheckCommand,
  remote,
}: PrimaryRelationParameters): SummaryAndInstructions {
  return {
    summary:
      `Local HEAD is ${head}; observed primary is ${primary}; relationship is ahead.`,
    instructions:
      `Validate local commit ${head}, confirm the remote tip is still ${primary}, then push normally to ${remote}/${primaryBranch} without force. Re-run ${recheckCommand} after the push.`,
  };
}
