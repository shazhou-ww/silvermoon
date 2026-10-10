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
  recheckCommand,
}: PrimaryAncestryFailedParameters) =>
  `修复或补全本地 Git 历史，直到可以比较 ${head} 和 ${primary}，然后再运行 ${recheckCommand}。`;

export default primaryAncestryInspectionFailed;
