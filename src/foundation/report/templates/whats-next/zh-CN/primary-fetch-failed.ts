/**
 * @template primary-fetch-failed
 * @when repository.fetchPrimary=failed
 * 用于 navigation 前无法 fetch primary 时。
 */
import type { PrimaryFetchFailedParameters } from "../contract.ts";

/** @pure */
export default function primaryFetchFailed({
  primaryBranch,
  primaryRepository,
  recheckCommand,
}: PrimaryFetchFailedParameters) {
  return `检查网络、授权、${primaryRepository} 和分支 ${primaryBranch}；产生可观察修复后，再运行 ${recheckCommand}。`;
}
