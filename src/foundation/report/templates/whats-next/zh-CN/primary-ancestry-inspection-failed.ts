/**
 * @template primary-ancestry-inspection-failed
 * @when repository.comparePrimary=failed
 * 用于无法比较本地与 primary commit ancestry 时。
 */
import type { PrimaryAncestryFailedParameters } from "../contract.ts";

/** @pure */
const primaryAncestryInspectionFailed = ({
  head,
  primary,
}: PrimaryAncestryFailedParameters) =>
  `目标是让本地 Git 历史足以可靠比较 ${head} 与 ${primary} 的 ancestry。`;

export default primaryAncestryInspectionFailed;
