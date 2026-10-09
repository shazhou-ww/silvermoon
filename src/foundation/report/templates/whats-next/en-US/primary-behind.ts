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
const primaryBehind = ({
  branch,
  head,
  mergeCommand,
  primary,
  recheckCommand,
}: PrimaryRelationParameters): SummaryAndInstructions =>
  ({
    summary:
      `Local HEAD is ${head}; observed primary is ${primary}; relationship is behind.`,
    instructions: [
      `Fast-forward branch ${branch} to observed primary ${primary} with ${mergeCommand}`,
      `without rewriting history, then run ${recheckCommand} again.`,
    ].join(" "),
  });

export default primaryBehind;
