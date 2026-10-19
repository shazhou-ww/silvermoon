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
}: PrimaryRelationParameters): SummaryAndNextSteps =>
  ({
    summary:
      `Local HEAD is ${head}; observed primary is ${primary}; relationship is diverged.`,
    nextSteps:
      `The goal is an integrated, validated history that preserves local ${head} and primary ${primary} without force-pushing.`,
  });

export default primaryDiverged;
