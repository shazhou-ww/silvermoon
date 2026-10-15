/**
 * @template primary-behind
 * @when repository.primaryRelation=behind
 * Used when local HEAD can fast-forward to the observed primary.
 */
import type {
  PrimaryRelationParameters,
  SummaryAndNextSteps,
} from "../contract.ts";

/** @pure */
const primaryBehind = ({
  branch,
  head,
  primary,
}: PrimaryRelationParameters): SummaryAndNextSteps =>
  ({
    summary:
      `Local HEAD is ${head}; observed primary is ${primary}; relationship is behind.`,
    nextSteps:
      `The goal is for branch ${branch} to reach observed primary ${primary} without rewriting history.`,
  });

export default primaryBehind;
