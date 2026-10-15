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
}: PrimaryAncestryFailedParameters) =>
  `The goal is locally available Git history that permits a reliable ancestry comparison between ${head} and ${primary}.`;

export default primaryAncestryInspectionFailed;
