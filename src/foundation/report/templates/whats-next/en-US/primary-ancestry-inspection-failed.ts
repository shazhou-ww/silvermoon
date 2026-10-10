/**
 * @template primary-ancestry-inspection-failed
 * @when repository.comparePrimary=failed
 * Used when local and primary commit ancestry cannot be compared.
 */
import type { PrimaryAncestryFailedParameters } from "../contract.ts";

/** @pure */
const primaryAncestryInspectionFailed = ({
  head,
  primary,
  recheckCommand,
}: PrimaryAncestryFailedParameters) =>
  [
    `Repair or deepen local Git history until ${head} and ${primary} can be compared,`,
    `then run ${recheckCommand} again.`,
  ].join(" ");

export default primaryAncestryInspectionFailed;
