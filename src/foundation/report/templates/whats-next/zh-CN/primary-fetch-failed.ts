/**
 * @template primary-fetch-failed
 * @when repository.fetchPrimary=failed
 * 用于 navigation 前无法 fetch primary 时。
 */
import type { PrimaryFetchFailedParameters } from "../contract.ts";

/** @pure */
const primaryFetchFailed = ({
  primaryBranch,
  primaryRepository,
}: PrimaryFetchFailedParameters) =>
  `目标是让配置 primary ${primaryRepository}#${primaryBranch} 可被 fetch，以完成权威观测。`;

export default primaryFetchFailed;
