/**
 * @template primary-fetch-failed
 * @when repository.fetchPrimary=failed
 * Used when primary cannot be fetched before navigation.
 */
import type { PrimaryFetchFailedParameters } from "../contract.ts";

/** @pure */
export default function primaryFetchFailed({
  primaryBranch,
  primaryRepository,
  recheckCommand,
}: PrimaryFetchFailedParameters) {
  return `Check network access, authorization, ${primaryRepository}, and branch ${primaryBranch}; after an observable fix, run ${recheckCommand} again.`;
}
