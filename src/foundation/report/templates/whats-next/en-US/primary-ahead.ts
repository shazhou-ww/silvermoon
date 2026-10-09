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
  recheckCommand,
  remote,
}: PrimaryRelationParameters): SummaryAndNextSteps =>
  ({
    summary:
      `Local HEAD is ${head}; observed primary is ${primary}; relationship is ahead.`,
    nextSteps: [
      `Validate local commit ${head}, confirm the remote tip is still ${primary},`,
      `then push normally to ${remote}/${primaryBranch} without force.`,
      `Re-run ${recheckCommand} after the push.`,
    ].join(" "),
  });

export default primaryAhead;
