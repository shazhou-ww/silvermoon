/**
 * @template primary-diverged
 * @when repository.primaryRelation=diverged
 * Used when local and primary histories must both be preserved and integrated.
 */
import type {
  PrimaryRelationParameters,
  SummaryAndNextSteps,
} from "../contract.ts";

/** @pure */
const primaryDiverged = ({
  head,
  primary,
  recheckCommand,
}: PrimaryRelationParameters): SummaryAndNextSteps =>
  ({
    summary:
      `Local HEAD is ${head}; observed primary is ${primary}; relationship is diverged.`,
    nextSteps: [
      `Preserve local ${head} and remote ${primary},`,
      `integrate both histories without force-pushing, resolve and validate the result,`,
      `then run ${recheckCommand} again.`,
    ].join(" "),
  });

export default primaryDiverged;
